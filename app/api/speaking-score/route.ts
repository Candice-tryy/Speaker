import { NextResponse } from "next/server";
import { transcribeSpeech } from "@/lib/iflytek-asr";
import { scoreSpeakingWithRubric } from "@/lib/speaking-rubric";
import type { SpeakingScoreResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rejected(advice: string, transcript = ""): NextResponse<SpeakingScoreResult> {
  return NextResponse.json({
    transcript,
    overall: 0,
    fluencyCoherence: 0,
    lexicalResource: 0,
    grammar: 0,
    pronunciation: 0,
    advice,
    evidence: [],
    source: { asr: "iflytek", scorer: "mock" },
    rejected: true,
  });
}

export async function POST(request: Request): Promise<NextResponse<SpeakingScoreResult>> {
  const body = await request.json().catch(() => ({}));
  const part = typeof body?.part === "string" ? body.part : "Part 1";
  const question = typeof body?.question === "string" ? body.question : "";
  const audioB64 = typeof body?.audio === "string" ? body.audio : "";
  const durationMs = typeof body?.durationMs === "number" ? body.durationMs : undefined;

  const appId = process.env.XFYUN_ASR_APP_ID || process.env.XFYUN_APP_ID;
  const apiKey = process.env.XFYUN_ASR_API_KEY || process.env.XFYUN_API_KEY;
  const apiSecret = process.env.XFYUN_ASR_API_SECRET || process.env.XFYUN_API_SECRET;
  const haveAsr = Boolean(appId && apiKey && apiSecret);
  const audioBytes = audioB64 ? Buffer.byteLength(audioB64, "base64") : 0;
  console.log(`[speaking-score] part=${part} haveASR=${haveAsr} audioBytes=${audioBytes} qLen=${question.length}`);

  if (!haveAsr) return rejected("还没有配置讯飞 ASR Key，暂时无法进行真实模拟评分。");
  if (!audioB64) return rejected("没有录到声音，请按住麦克风完整回答后再松手。");

  let transcript = "";
  try {
    transcript = await transcribeSpeech({
      creds: { appId: appId!, apiKey: apiKey!, apiSecret: apiSecret! },
      pcm: Buffer.from(audioB64, "base64"),
    });
  } catch (err) {
    console.error("[speaking-score] ASR error:", err);
    return rejected("语音转写暂时失败，请靠近麦克风再试一次。");
  }

  if (!transcript) return rejected("没有听清你的回答，请重新录一遍。");
  if (transcript.split(/\s+/).filter(Boolean).length < 3) return rejected("回答太短了，请至少说完整一句话。", transcript);

  const score = await scoreSpeakingWithRubric({ part, question, transcript, durationMs });
  return NextResponse.json(score);
}
