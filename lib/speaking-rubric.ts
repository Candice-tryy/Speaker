import type { SpeakingScoreResult } from "./types";

const BASE_URL = process.env.LLM_BASE_URL || "https://api.deepseek.com/v1";
const MODEL = process.env.LLM_MODEL || "deepseek-chat";

interface RubricArgs {
  part: string;
  question: string;
  transcript: string;
  durationMs?: number;
}

function clampBand(value: unknown, fallback = 6): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(9, Math.round(n * 2) / 2));
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in LLM response");
  return JSON.parse(raw.slice(start, end + 1));
}

function unavailableScore({ transcript }: RubricArgs, advice: string): SpeakingScoreResult {
  return {
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
  };
}

export async function scoreSpeakingWithRubric(args: RubricArgs): Promise<SpeakingScoreResult> {
  const key = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY;
  if (!key) return unavailableScore(args, "还没有配置 DeepSeek Key，暂时无法进行真实模拟评分。");

  const durationSec = args.durationMs ? Math.max(1, Math.round(args.durationMs / 1000)) : "unknown";
  const prompt =
    `Part: ${args.part}\n` +
    `Question: ${args.question}\n` +
    `Answer transcript: ${args.transcript}\n` +
    `Answer duration seconds: ${durationSec}\n\n` +
    "Score this IELTS Speaking answer. Return strict JSON only with keys: " +
    "overall, fluencyCoherence, lexicalResource, grammar, pronunciation, evidence, advice. " +
    "Scores must be IELTS bands from 0 to 9 in 0.5 steps. evidence must be 2-4 short Chinese strings. " +
    "advice must be one warm Chinese sentence starting with 如果只改一件事：. " +
    "Be conservative. Penalize short, off-topic, memorized, or under-developed answers.";

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a strict IELTS Speaking examiner. Use the public IELTS speaking rubric. " +
              "You are scoring from ASR transcript, so do not overclaim exact pronunciation. " +
              "Use Chinese for evidence and advice. Return JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text().catch(() => "")}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content) as Partial<SpeakingScoreResult>;
    const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.map(String).slice(0, 4) : [];
    return {
      transcript: args.transcript,
      overall: clampBand(parsed.overall),
      fluencyCoherence: clampBand(parsed.fluencyCoherence),
      lexicalResource: clampBand(parsed.lexicalResource),
      grammar: clampBand(parsed.grammar),
      pronunciation: clampBand(parsed.pronunciation),
      advice: typeof parsed.advice === "string" && parsed.advice.trim() ? parsed.advice.trim() : "如果只改一件事：回答再展开一个具体例子，让观点更有支撑。",
      evidence,
      source: { asr: "iflytek", scorer: "deepseek" },
    };
  } catch (err) {
    console.error("Speaking rubric failed:", err);
    return unavailableScore(args, "模拟评分服务暂时不可用，请稍后再试。");
  }
}
