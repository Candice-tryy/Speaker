import Taro from "@tarojs/taro";

// 16k mono PCM recorder for the mini program. The backend /api/score feeds
// this straight into 讯飞 ISE (deterministic pronunciation scoring), so the
// format must match the web client: 16000 Hz, single channel, raw PCM.
// Sibling: lib/recorder.ts (repo root) is the web implementation of the same
// contract — keep the output format in sync when changing either.
//
// We accumulate frames via onFrameRecorded so we end up with raw PCM bytes
// (RecorderManager's onStop temp file would be a wrapped format).

function concatBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const total = buffers.reduce((n, b) => n + b.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    out.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return out.buffer;
}

export interface RecordingController {
  stop: () => Promise<string>; // resolves to base64 PCM
  cancel: () => void;
}

interface RecorderStopResult {
  tempFilePath?: string;
}

function pcmFrameLevel(frame: ArrayBuffer): number {
  const view = new DataView(frame);
  const sampleCount = Math.floor(frame.byteLength / 2);
  if (!sampleCount) return 0;
  let sum = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = view.getInt16(i * 2, true) / 32768;
    sum += sample * sample;
  }
  return Math.min(1, Math.sqrt(sum / sampleCount) * 6);
}

// Make sure 录音 permission is granted before we start. If the user denied it
// earlier, RecorderManager.start would silently fail, so we route them to the
// settings panel to re-enable. Returns true when recording may proceed.
export async function ensureRecordPermission(): Promise<boolean> {
  try {
    const setting = await Taro.getSetting();
    const state = setting.authSetting["scope.record"];
    if (state === true) return true;
    if (state === false) {
      const res = await Taro.openSetting();
      return res.authSetting["scope.record"] === true;
    }
    // undefined: never asked — authorize triggers the prompt.
    await Taro.authorize({ scope: "scope.record" });
    return true;
  } catch {
    // authorize rejected => denied; offer settings as a last chance.
    try {
      const res = await Taro.openSetting();
      return res.authSetting["scope.record"] === true;
    } catch {
      return false;
    }
  }
}

export function startRecording(onLevel?: (level: number) => void): Promise<RecordingController> {
  return new Promise((resolve, reject) => {
    const manager = Taro.getRecorderManager();
    const frames: ArrayBuffer[] = [];
    let stopResolve: ((b64: string) => void) | null = null;
    let stopReject: ((err: unknown) => void) | null = null;
    let startSettled = false;
    let cancelled = false;
    let stopped = false;

    const cleanup = () => {
      const rec = manager as unknown as {
        offFrameRecorded?: () => void;
        offStop?: () => void;
        offError?: () => void;
        offStart?: () => void;
      };
      rec.offFrameRecorded?.();
      rec.offStop?.();
      rec.offError?.();
      rec.offStart?.();
    };

    const readTempFile = (tempFilePath?: string): Promise<ArrayBuffer | null> => {
      if (!tempFilePath) return Promise.resolve(null);
      const fs = Taro.getFileSystemManager?.();
      if (!fs) return Promise.resolve(null);
      return new Promise((res) => {
        fs.readFile({
          filePath: tempFilePath,
          success: (file) => res(file.data as ArrayBuffer),
          fail: () => res(null),
        });
      });
    };

    manager.onFrameRecorded((res) => {
      if (res.frameBuffer) {
        frames.push(res.frameBuffer);
        onLevel?.(pcmFrameLevel(res.frameBuffer));
      }
    });

    manager.onStop(async (result: RecorderStopResult) => {
      if (cancelled || !stopResolve) {
        cleanup();
        return;
      }
      try {
        const pcm = frames.length ? concatBuffers(frames) : await readTempFile(result?.tempFilePath);
        if (!pcm || pcm.byteLength === 0) throw new Error("empty recording");
        stopResolve(Taro.arrayBufferToBase64(pcm));
      } catch (err) {
        stopReject?.(err);
      } finally {
        stopResolve = null;
        stopReject = null;
        cleanup();
      }
    });

    manager.onError((err) => {
      console.error("recorder error", err);
      if (!startSettled) {
        startSettled = true;
        cleanup();
        reject(err);
        return;
      }
      stopReject?.(err);
      stopResolve = null;
      stopReject = null;
      cleanup();
    });

    manager.onStart(() => {
      startSettled = true;
      resolve({
        stop: () =>
          new Promise<string>((res, rej) => {
            if (stopped) {
              rej(new Error("recording already stopped"));
              return;
            }
            stopped = true;
            stopResolve = res;
            stopReject = rej;
            onLevel?.(0);
            manager.stop();
          }),
        cancel: () => {
          cancelled = true;
          stopped = true;
          onLevel?.(0);
          manager.stop();
          cleanup();
        },
      });
    });

    try {
      manager.start({
        // IELTS Part 2 answers run to ~2 minutes; the backend splits long
        // audio into ≤55s segments for 讯飞 IAT, so the cap is UX headroom,
        // not an ASR limit. WeChat allows up to 600000.
        duration: 150000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: "PCM",
        frameSize: 4, // KB per onFrameRecorded callback
      });
    } catch (e) {
      reject(e);
    }
  });
}
