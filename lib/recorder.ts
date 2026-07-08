// Client-side mic recorder producing 16kHz / 16-bit / mono PCM (base64) — the format
// 讯飞 ISE expects. Records via MediaRecorder (reliable, no main-thread frame drops),
// then decodes and resamples to 16k with OfflineAudioContext (proper anti-aliased
// resampling + automatic downmix to mono). An earlier ScriptProcessorNode + naive
// decimation version dropped audio and aliased, which made ISE mark words as 漏读.

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

async function resampleTo16kMonoPcm(buffer: AudioBuffer): Promise<Int16Array> {
  const targetRate = 16000;
  const length = Math.max(1, Math.ceil(buffer.duration * targetRate));
  const offline = new OfflineAudioContext(1, length, targetRate);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return floatToInt16(rendered.getChannelData(0));
}

export class PcmRecorder {
  private stream?: MediaStream;
  private rec?: MediaRecorder;
  private chunks: Blob[] = [];
  private levelContext?: AudioContext;
  private levelFrame?: number;
  private onLevel?: (level: number) => void;

  async start(onLevel?: (level: number) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    this.onLevel = onLevel;
    this.chunks = [];
    this.rec = new MediaRecorder(this.stream);
    this.rec.ondataavailable = (e) => {
      if (e.data && e.data.size) this.chunks.push(e.data);
    };
    this.rec.start();
    this.startLevelMeter();
  }

  /** Stop recording and return 16k mono 16-bit PCM as base64 ("" if nothing usable). */
  async stop(): Promise<string> {
    const rec = this.rec;
    this.rec = undefined;
    if (!rec) return "";

    if (rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        rec.stop();
      });
    }
    this.stopLevelMeter();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;

    const blob = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
    this.chunks = [];
    if (!blob.size) return "";

    try {
      const buf = await blob.arrayBuffer();
      const ac = new AudioContext();
      const decoded = await ac.decodeAudioData(buf);
      await ac.close();
      const pcm16 = await resampleTo16kMonoPcm(decoded);
      return base64FromBytes(new Uint8Array(pcm16.buffer));
    } catch {
      return "";
    }
  }

  cancel(): void {
    try {
      if (this.rec && this.rec.state !== "inactive") this.rec.stop();
      this.stopLevelMeter();
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    this.rec = undefined;
    this.stream = undefined;
    this.chunks = [];
  }

  private startLevelMeter(): void {
    if (!this.stream || !this.onLevel) return;
    try {
      const AudioContextCtor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor() as AudioContext;
      const source = context.createMediaStreamSource(this.stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const centered = (data[i] - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / data.length);
        this.onLevel?.(Math.min(1, rms * 6));
        this.levelFrame = window.requestAnimationFrame(tick);
      };
      this.levelContext = context;
      tick();
    } catch {}
  }

  private stopLevelMeter(): void {
    if (this.levelFrame != null) {
      window.cancelAnimationFrame(this.levelFrame);
      this.levelFrame = undefined;
    }
    this.onLevel?.(0);
    this.onLevel = undefined;
    void this.levelContext?.close().catch(() => {});
    this.levelContext = undefined;
  }
}
