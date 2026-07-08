import { NextResponse } from "next/server";
import type { ScoreResult } from "@/lib/types";
import { assessReading } from "@/lib/iflytek-ise";
import { mapIseToBand } from "@/lib/score-map";
import { generateAdvice } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Scoring endpoint. For 跟读 (follow) mode with credentials + audio present, it runs
// real pronunciation scoring via 讯飞 ISE (deterministic dimension scores) and uses
// Haiku to phrase a single-point improvement tip. Otherwise it returns a mock band
// so the prototype keeps working without credentials.
//
// See PRD §7 "信任地雷": dimensions stay narrow (pronunciation + fluency), the score
// comes from a deterministic engine (not the LLM), and one single-point reason.

function mockResult(mode: string, recited: boolean): ScoreResult {
  const band = recited ? 6.5 : 6.0;
  const advice = recited
    ? "稳了！语速和连读都不错，保持这个节奏。"
    : mode === "mock"
      ? "意思到位，再多用一个高级搭配会更亮眼。"
      : '如果只改一件事：把句尾的 /t/ 收清楚，比如 "straight"。';
  return { band, pronunciation: band, fluency: band, advice, source: "mock" };
}

export async function POST(request: Request): Promise<NextResponse<ScoreResult>> {
  const body = await request.json().catch(() => ({}));
  const mode: string = body?.mode === "mock" ? "mock" : "follow";
  const recited: boolean = Boolean(body?.recited);
  const refText: string = typeof body?.refText === "string" ? body.refText : "";
  const audioB64: string = typeof body?.audio === "string" ? body.audio : "";

  const appId = process.env.XFYUN_APP_ID;
  const apiKey = process.env.XFYUN_API_KEY;
  const apiSecret = process.env.XFYUN_API_SECRET;
  const haveISE = Boolean(appId && apiKey && apiSecret);
  const audioBytes = audioB64 ? Buffer.byteLength(audioB64, "base64") : 0;
  console.log(`[score] req mode=${mode} haveISE=${haveISE} audioBytes=${audioBytes} refLen=${refText.length}`);

  const retry = (advice: string): NextResponse<ScoreResult> =>
    NextResponse.json({ band: 0, pronunciation: 0, fluency: 0, advice, source: "iflytek", rejected: true });

  // Real pronunciation scoring only for follow (read-aloud) mode. Open-ended 模拟
  // answering needs ASR + LLM, which is a later step — it stays on the mock path.
  if (mode === "follow" && haveISE && refText) {
    // ISE is configured: never fake a mock score here, or trust is destroyed.
    if (!audioB64) {
      console.log("[score] no audio -> retry");
      return retry("没录到声音，请点一下开始录音，读完整段后再点一下提交。");
    }
    try {
      const pcm = Buffer.from(audioB64, "base64");
      const scores = await assessReading({
        creds: { appId: appId!, apiKey: apiKey!, apiSecret: apiSecret! },
        refText,
        pcm,
      });
      console.log("[score] ISE scores:", JSON.stringify(scores));
      if (scores.rejected || scores.total == null) {
        return retry("没听清你的发音，请靠近麦克风，读完整段后再点一下提交。");
      }
      const mapped = mapIseToBand(scores);
      const advice = await generateAdvice(refText, scores);
      return NextResponse.json({ ...mapped, advice, source: "iflytek" });
    } catch (err) {
      console.error("[score] ISE error:", err);
      return retry("评分服务暂时异常，请重试一次。");
    }
  } else {
    console.log("[score] skipping ISE -> mock (no creds / mock mode)");
  }

  return NextResponse.json(mockResult(mode, recited));
}
