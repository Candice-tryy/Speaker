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

export const FALLBACK_PARTS: Part[] = [
  {
    name: "Part 1",
    peaks: [
      {
        name: "日常表达",
        topics: ["Hometown", "Study", "Weekend", "Food", "Weather"],
        boss: "Warm-up Boss",
        done: 0,
        cards: [
          makeTopic("p1-home", "Hometown", 1, ["Where is your hometown?", "What do you like about it?", "Has it changed much?"]),
          makeTopic("p1-study", "Study", 1, ["What do you study?", "Why did you choose it?", "Do you enjoy your major?"]),
          makeTopic("p1-weekend", "Weekend", 1, ["What do you usually do on weekends?", "Do you prefer staying in or going out?", "How do you relax?"]),
          makeTopic("p1-food", "Food", 1, ["What food do you like?", "Can you cook?", "Do you often eat out?"]),
          makeTopic("p1-weather", "Weather", 1, ["What weather do you like?", "Does weather affect your mood?", "What is the weather like in your city?"]),
        ],
      },
    ],
  },
  {
    name: "Part 2&3",
    peaks: [
      {
        name: "人物与经历",
        topics: ["A helpful person", "A good decision", "A trip", "A skill", "A gift"],
        boss: "Examiner Boss",
        done: 0,
        cards: [
          makeTopic("p23-person", "A helpful person", 2, ["Describe a person who helped you.", "Who is this person?", "How did they help you?"]),
          makeTopic("p23-decision", "A good decision", 2, ["Describe a good decision you made.", "When did you make it?", "Why was it important?"]),
          makeTopic("p23-trip", "A trip", 2, ["Describe a memorable trip.", "Where did you go?", "What made it special?"]),
          makeTopic("p23-skill", "A skill", 2, ["Describe a skill you want to learn.", "What is it?", "Why do you want to learn it?"]),
          makeTopic("p23-gift", "A gift", 2, ["Describe a gift you received.", "Who gave it to you?", "Why did you like it?"]),
        ],
      },
      {
        name: "地点与物品",
        topics: ["A quiet place", "A cafe", "A useful object", "A photo", "A book"],
        boss: "Examiner Boss",
        done: 0,
        cards: [
          makeTopic("p23-place", "A quiet place", 2, ["Describe a quiet place you like.", "Where is it?", "What do you do there?"]),
          makeTopic("p23-cafe", "A cafe", 2, ["Describe a cafe you like.", "Where is it?", "Why do you go there?"]),
          makeTopic("p23-object", "A useful object", 2, ["Describe a useful object.", "What is it?", "How do you use it?"]),
          makeTopic("p23-photo", "A photo", 2, ["Describe a photo you like.", "When was it taken?", "Why is it meaningful?"]),
          makeTopic("p23-book", "A book", 2, ["Describe a book you enjoyed.", "What is it about?", "Why did you like it?"]),
        ],
      },
    ],
  },
  {
    name: "Part 2串题",
    peaks: [
      {
        name: "当季串题",
        topics: ["发小", "旅行", "学习", "礼物"],
        boss: "Combo Boss",
        done: 0,
        cards: [
          makeTopic("combo-friend", "发小", 2, ["Describe a childhood friend.", "How did you meet?", "What did you do together?"]),
          makeTopic("combo-trip", "旅行", 2, ["Describe a trip you planned.", "Where did you go?", "What happened?"]),
          makeTopic("combo-study", "学习", 2, ["Describe something useful you learned.", "How did you learn it?", "How do you use it?"]),
          makeTopic("combo-gift", "礼物", 2, ["Describe a meaningful gift.", "Who gave it to you?", "Why was it special?"]),
        ],
      },
    ],
  },
];

function makeTopic(id: string, title: string, part: number, prompts: string[]): Topic {
  return {
    id,
    title,
    tag: title,
    part,
    questions: prompts.map((content, index) => ({
      id: `${id}-q${index + 1}`,
      part,
      content,
      answer:
        "In my opinion, the key point is to give a clear example and explain why it matters. For example, I would connect the topic with my daily life and add one specific detail.",
    })),
  };
}

export async function getBank(): Promise<{ parts: Part[]; loaded: boolean }> {
  try {
    const res = await Taro.request({
      url: `${BASE_URL}/api/bank`,
      method: "GET",
      timeout: 8000,
    });
    const data = res.data as { parts?: Part[]; loaded?: boolean };
    if (Array.isArray(data.parts) && data.parts.length > 0) {
      return { parts: data.parts, loaded: data.loaded !== false };
    }
  } catch {}
  return { parts: FALLBACK_PARTS, loaded: false };
}

export async function scoreAudio(params: {
  refText: string;
  audioBase64: string;
  recited?: boolean;
}): Promise<ScoreResult> {
  try {
    const res = await Taro.request({
      url: `${BASE_URL}/api/score`,
      method: "POST",
      timeout: 60000,
      header: { "content-type": "application/json" },
      data: {
        mode: "follow",
        recited: params.recited ?? true,
        refText: params.refText,
        audio: params.audioBase64,
      },
    });
    return res.data as ScoreResult;
  } catch {
    return {
      band: 6.5,
      pronunciation: 6.5,
      fluency: 6.5,
      advice: "后端暂时没连上，先用演示评分：保持语速稳定，再把句尾收清楚。",
      source: "mock",
    };
  }
}
