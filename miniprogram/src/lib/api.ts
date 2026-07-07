import Taro from "@tarojs/taro";

// Point this at the Next.js backend (the repo root app/api/*).
// Dev: your computer's LAN IP while `npm run dev` runs at the repo root —
// works from both the devtools simulator and a real phone on the same Wi-Fi.
// (IP changes when you switch networks: re-check with `ipconfig`.)
// Prod: your ICP-filed HTTPS domain (must be in 服务器域名 whitelist).
export const BASE_URL = "http://172.20.10.3:3000";

export interface Question {
  id: string;
  part: number;
  content: string;
  is_show?: number;
  answer?: string;
}

// A question massaged for the practice card: cue cards are split into a short
// title (qtext) + bullet lines, and the reference answer always has a fallback.
export interface PracticeQuestion extends Question {
  qtext: string;
  bullets: string[];
  answer: string;
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
          // part 4 = combo questions, matching the real bank's numbering so
          // toPracticeQuestions' part filter keeps them.
          makeTopic("combo-friend", "发小", 4, ["Describe a childhood friend.", "How did you meet?", "What did you do together?"]),
          makeTopic("combo-trip", "旅行", 4, ["Describe a trip you planned.", "Where did you go?", "What happened?"]),
          makeTopic("combo-study", "学习", 4, ["Describe something useful you learned.", "How did you learn it?", "How do you use it?"]),
          makeTopic("combo-gift", "礼物", 4, ["Describe a meaningful gift.", "Who gave it to you?", "Why was it special?"]),
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

export function partQuestionNo(partName: string): number {
  if (partName === "Part 1") return 1;
  if (partName === "Part 3") return 3;
  if (partName === "Part 2串题" || partName.includes("串题")) return 4;
  return 2;
}

export function splitCueCard(text: string): { title: string; bullets: string[] } {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  const marker = clean.match(/\bYou should say:?\s*/i);
  if (!marker) return { title: clean, bullets: [] };
  const title = clean.slice(0, marker.index).trim();
  const rest = clean.slice((marker.index || 0) + marker[0].length).trim();
  const bullets = rest
    .split(/\s+(?=(?:Who|What|When|Where|Why|How|And explain)\b)/i)
    .map((item) => item.trim())
    .filter(Boolean);
  return { title, bullets };
}

export function fallbackAnswer(question: Question | undefined, topic: Topic | undefined): string {
  if (question?.answer) return question.answer;
  return `I would like to talk about ${
    topic?.title || "this topic"
  }. In my opinion, the most important point is balance. I would answer it with a clear example, then explain one reason and one personal feeling, so the response sounds natural and complete.`;
}

export function toPracticeQuestions(topic: Topic, partName: string): PracticeQuestion[] {
  const partNo = partQuestionNo(partName);
  return topic.questions
    .filter((q) => q.is_show !== 0)
    .filter((q) => (partName === "Part 2&3" ? q.part === 2 || q.part === 3 : q.part === partNo))
    .map((q) => {
      if (q.part === 4) {
        return { ...q, qtext: topic.title, bullets: [q.content], answer: fallbackAnswer(q, topic) };
      }
      if (q.part === 2) {
        const cue = splitCueCard(q.content);
        return {
          ...q,
          qtext: cue.title || q.content,
          bullets: cue.bullets.length ? cue.bullets : [topic.title],
          answer: fallbackAnswer(q, topic),
        };
      }
      return { ...q, qtext: q.content, bullets: [topic.title], answer: fallbackAnswer(q, topic) };
    });
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
  mode?: "follow" | "mock";
  recited?: boolean;
}): Promise<ScoreResult> {
  try {
    const res = await Taro.request({
      url: `${BASE_URL}/api/score`,
      method: "POST",
      timeout: 60000,
      header: { "content-type": "application/json" },
      data: {
        mode: params.mode || "follow",
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
