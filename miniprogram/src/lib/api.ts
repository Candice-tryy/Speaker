import Taro from "@tarojs/taro";

// Point this at the Next.js backend (the repo root app/api/*).
// Dev: your computer's LAN IP while `npm run dev` runs at the repo root.
// Prod: your ICP-filed HTTPS domain (must be in 服务器域名 whitelist).
export const BASE_URL = "http://localhost:3000";

export interface Question {
  id: string;
  part: number;
  content: string;
  answer?: string;
}
export interface Topic {
  id: string;
  title: string;
  tag?: string;
  part: number;
  questions: Question[];
}
export interface Peak {
  name: string;
  topics: string[];
  cards: Topic[];
  boss: string;
  done: number;
}
export interface Part {
  name: string;
  peaks: Peak[];
}
export interface ScoreResult {
  band: number;
  pronunciation: number;
  fluency: number;
  advice: string;
  source?: "iflytek" | "mock";
  rejected?: boolean;
}

export async function getBank(): Promise<{ parts: Part[]; loaded: boolean }> {
  const res = await Taro.request({
    url: `${BASE_URL}/api/bank`,
    method: "GET",
  });
  return res.data as { parts: Part[]; loaded: boolean };
}

export async function scoreAudio(params: {
  refText: string;
  audioBase64: string;
  recited?: boolean;
}): Promise<ScoreResult> {
  const res = await Taro.request({
    url: `${BASE_URL}/api/score`,
    method: "POST",
    header: { "content-type": "application/json" },
    data: {
      mode: "follow",
      recited: params.recited ?? true,
      refText: params.refText,
      audio: params.audioBase64,
    },
  });
  return res.data as ScoreResult;
}
