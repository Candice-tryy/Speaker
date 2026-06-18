import Taro from "@tarojs/taro";

// 16k mono PCM recorder for the mini program. The backend /api/score feeds
// this straight into 讯飞 ISE (deterministic pronunciation scoring), so the
// format must match the web client: 16000 Hz, single channel, raw PCM.
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

export function startRecording(): Promise<RecordingController> {
  return new Promise((resolve, reject) => {
    const manager = Taro.getRecorderManager();
    const frames: ArrayBuffer[] = [];
    let stopResolve: ((b64: string) => void) | null = null;
    let cancelled = false;

    manager.onFrameRecorded((res) => {
      if (res.frameBuffer) frames.push(res.frameBuffer);
    });

    manager.onStop(() => {
      if (cancelled || !stopResolve) return;
      const pcm = concatBuffers(frames);
      stopResolve(Taro.arrayBufferToBase64(pcm));
      stopResolve = null;
    });

    manager.onError((err) => {
      if (stopResolve) {
        // surface as empty so the caller can decide; or reject the start.
      }
      console.error("recorder error", err);
    });

    manager.onStart(() => {
      resolve({
        stop: () =>
          new Promise<string>((res) => {
            stopResolve = res;
            manager.stop();
          }),
        cancel: () => {
          cancelled = true;
          manager.stop();
        },
      });
    });

    try {
      manager.start({
        duration: 60000,
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
