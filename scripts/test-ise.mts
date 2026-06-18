// One-off connectivity test: verifies 讯飞 ISE auth/protocol and Haiku, using the
// real lib code. Synthetic audio won't produce a meaningful pronunciation score,
// but a non-auth response proves credentials + the WebSocket frame flow work.
//   run: node scripts/test-ise.mts
import { readFileSync } from "node:fs";
import { assessReading } from "../lib/iflytek-ise.ts";
import { generateAdvice } from "../lib/llm.ts";

// minimal .env.local loader
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const refText = "I usually get up at around seven in the morning.";

// 2s of a 220Hz tone as placeholder "audio" (16k / 16-bit / mono PCM)
const rate = 16000;
const n = rate * 2;
const pcm = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) {
  const s = Math.sin((2 * Math.PI * 220 * i) / rate) * 0.3;
  pcm.writeInt16LE(Math.round(s * 32767), i * 2);
}

console.log("APPID:", process.env.XFYUN_APP_ID);
console.log("--- ISE ---");
try {
  const scores = await assessReading({
    creds: {
      appId: process.env.XFYUN_APP_ID!,
      apiKey: process.env.XFYUN_API_KEY!,
      apiSecret: process.env.XFYUN_API_SECRET!,
    },
    refText,
    pcm,
  });
  console.log("ISE OK, scores:", scores);
} catch (e) {
  console.log("ISE error:", e instanceof Error ? e.message : e);
}

console.log("--- LLM advice (DeepSeek) ---");
try {
  const advice = await generateAdvice(refText, { total: 3.5, standard: 3, fluency: 4, integrity: 4.5 });
  console.log("advice:", advice);
} catch (e) {
  console.log("Haiku error:", e instanceof Error ? e.message : e);
}
