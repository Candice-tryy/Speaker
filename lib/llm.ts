import type { IseScores } from "./types";

// Generates the single-point improvement advice (PRD: "如果只改一件事…") in Chinese,
// from the deterministic ISE dimension scores. The LLM only phrases advice — it does
// NOT score pronunciation.
//
// Uses an OpenAI-compatible chat endpoint, default DeepSeek (deepseek-chat), which is
// directly reachable from mainland China. Swap providers by overriding LLM_BASE_URL /
// LLM_MODEL (e.g. Qwen / 智谱 GLM) — they all speak the same API shape.
// (Claude was dropped here: the Anthropic API is geo-blocked in CN/HK.)

const BASE_URL = process.env.LLM_BASE_URL || "https://api.deepseek.com/v1";
const MODEL = process.env.LLM_MODEL || "deepseek-chat";

function templateAdvice(scores: IseScores): string {
  const dims: Array<[string, number | undefined, string]> = [
    ["发音", scores.standard ?? scores.accuracy, "把重音和元音读得更饱满一点"],
    ["流利度", scores.fluency, "减少停顿，让句子之间更连贯"],
    ["完整度", scores.integrity, "尽量把整段读完整，别漏词"],
  ];
  const valid = dims.filter((d) => d[1] != null) as Array<[string, number, string]>;
  if (!valid.length) return "再跟读一遍，注意发音清晰、语速平稳。";
  valid.sort((a, b) => a[1] - b[1]);
  const [name, , tip] = valid[0];
  return `如果只改一件事：${name}还有提升空间，${tip}。`;
}

export async function generateAdvice(refText: string, scores: IseScores): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY;
  if (!key) return templateAdvice(scores);

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "你是雅思口语跟读教练。根据发音测评引擎给出的分数，只给一条最关键的改进建议，" +
              "用中文，口吻温和鼓励，控制在40字以内，以「如果只改一件事：」开头。只评发音和流利度，不要罗列多条。",
          },
          {
            role: "user",
            content:
              `参考原文：${refText}\n` +
              `测评分数(0-5)：发音(standard)=${scores.standard ?? "NA"}，` +
              `准确度(accuracy)=${scores.accuracy ?? "NA"}，` +
              `流利度(fluency)=${scores.fluency ?? "NA"}，` +
              `完整度(integrity)=${scores.integrity ?? "NA"}，` +
              `总分(total)=${scores.total ?? "NA"}。\n` +
              `请给出一条最关键的改进建议。`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status} ${await res.text().catch(() => "")}`);
    const data = await res.json();
    const advice: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return advice || templateAdvice(scores);
  } catch (err) {
    console.error("LLM advice failed, using template:", err);
    return templateAdvice(scores);
  }
}
