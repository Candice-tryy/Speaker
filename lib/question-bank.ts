import { promises as fs } from "fs";
import path from "path";
import type { Bank, Part, Peak, Question, Topic } from "./types";

const RESOURCE = path.join(process.cwd(), "Resource");
const PATHS = {
  part1: path.join(RESOURCE, "PART1\u9898\u5e93", "papaen_part1_archive.json"),
  part23: path.join(RESOURCE, "PART2&3\u9898\u5e93", "papaen_part23_current.json"),
  part23Answers: path.join(RESOURCE, "PART2&3\u9898\u5e93", "part23_band7_sample_answers.json"),
  part2Combo: path.join(RESOURCE, "PART2\u4e32\u9898\u9898\u5e93", "papaen_part2_combo_current.json"),
};

const PART2_COMBO = "Part 2\u4e32\u9898";

const FALLBACK_TOPICS: Topic[] = [
  {
    id: "fallback-p1",
    title: "The area you live in",
    part: 1,
    questions: [
      { id: "fallback-p1-q1", part: 1, content: "What are some changes in the area recently?" },
      { id: "fallback-p1-q2", part: 1, content: "Are the people in your neighborhood nice and friendly?" },
      { id: "fallback-p1-q3", part: 1, content: "Do you like the area that you live in?" },
    ],
  },
  {
    id: "fallback-p23",
    title: "Childhood friend",
    part: 2,
    questions: [
      {
        id: "fallback-p23-q1",
        part: 2,
        content:
          "Describe a friend from your childhood You should say: Who he/she is Where you met each other What you often did together And explain what made you like him/her",
      },
      { id: "fallback-p23-q2", part: 3, content: "What do you think of online social media?" },
      { id: "fallback-p23-q3", part: 3, content: "Do you still keep in touch with your friends from childhood? Why or why not?" },
    ],
  },
  {
    id: "fallback-combo",
    title: "Childhood friend + early rising + long-term goal",
    part: 4,
    questions: [
      {
        id: "fallback-combo-q1",
        part: 4,
        content: "Use one prepared story to cover several related Part 2 topics. Adjust the beginning and ending to match the exact prompt.",
        answer:
          "I would talk about a childhood friend who helped me build an early rising habit. This story can also connect to changing plans, receiving help, solving a problem, and setting a long-term goal.",
      },
    ],
  },
];

let cache: Bank | undefined;

async function loadJSON(file: string): Promise<unknown> {
  const text = await fs.readFile(file, "utf8");
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

function cleanText(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function normalizeTopic(topic: any, partHint: number): Topic {
  const questions: Question[] = (topic.questions || [])
    .map((q: any) => ({
      id: String(q.id),
      index: q.index,
      part: q.part || partHint,
      content: cleanText(q.content),
      is_show: q.is_show,
      answer: cleanText(q.answers?.[0]?.content),
    }))
    .filter((q: Question) => q.content);

  return {
    id: String(topic.id),
    index: topic.index,
    title: cleanText(topic.title),
    tag: cleanText(topic.tag_name),
    level: topic.level,
    isNew: topic.is_new === 1,
    isShow: topic.is_show !== 0,
    part: partHint,
    questions,
  };
}

function normalizeAnswers(data: any): Map<string, string> {
  const out = new Map<string, string>();
  (data?.topics || []).forEach((topic: any) => {
    (topic.answers || []).forEach((item: any) => {
      out.set(String(item.question_id), cleanText(item.answer));
    });
  });
  return out;
}

function withAnswers(topics: Topic[], answerMap: Map<string, string>): Topic[] {
  return topics.map((topic) => ({
    ...topic,
    questions: topic.questions.map((q) => ({
      ...q,
      answer: answerMap.get(String(q.id)) || q.answer || "",
    })),
  }));
}

function shownTopics(topics: Topic[]): Topic[] {
  const shown = topics.filter((t) => t.isShow && t.questions.length);
  return shown.length ? shown : topics.filter((t) => t.questions.length);
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

function topicQuestionLabel(topic: Topic, part: number): string {
  const question = topic.questions.find((q) => q.part === part) || topic.questions[0];
  if (!question) return topic.title;
  if (part === 2) return shortLabel(cueTitle(question.content));
  return shortLabel(question.content);
}

export function cueTitle(text: string): string {
  return cleanText(text)
    .replace(/^Describe\s+/i, "")
    .replace(/\s+You should say:?.*$/i, "")
    .replace(/[.。]$/, "");
}

function shortLabel(text: string, max = 24): string {
  const clean = cleanText(text);
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function isTopicNodePart(partName: string): boolean {
  return partName === "Part 1" || partName === "Part 2&3" || partName === PART2_COMBO;
}

function nodesPerPeak(partName: string): number {
  return partName === PART2_COMBO ? 4 : isTopicNodePart(partName) ? 7 : 3;
}

function partQuestionNo(partName: string): number {
  if (partName === "Part 1") return 1;
  if (partName === "Part 3") return 3;
  if (partName === PART2_COMBO) return 4;
  return 2;
}

function makePeak(topics: Topic[], partName: string, index: number): Peak {
  const cards = topics.slice(0, nodesPerPeak(partName));
  const topicLabels = cards.map((t) =>
    isTopicNodePart(partName) ? shortLabel(t.title, 18) : topicQuestionLabel(t, partName === "Part 3" ? 3 : 2)
  );
  if (!isTopicNodePart(partName)) {
    while (topicLabels.length < 3) topicLabels.push("Practice card");
  }
  return {
    name: isTopicNodePart(partName) ? `Set ${index + 1}` : cards[0]?.tag || cards[0]?.title || `${partName} Set ${index + 1}`,
    topics: topicLabels,
    cards,
    boss: "Examiner",
    done: 0,
  };
}

function makeParts(part1Topics: Topic[], part23Topics: Topic[], comboTopics: Topic[]): Part[] {
  const p1 = shownTopics(part1Topics);
  const p23 = shownTopics(part23Topics);
  const combo = shownTopics(comboTopics);
  return [
    { name: "Part 1", peaks: chunk(p1, 7).map((topics, i) => makePeak(topics, "Part 1", i)) },
    { name: "Part 2&3", peaks: chunk(p23, 7).map((topics, i) => makePeak(topics, "Part 2&3", i)) },
    { name: PART2_COMBO, peaks: chunk(combo, 4).map((topics, i) => makePeak(topics, PART2_COMBO, i)) },
  ];
}

function indexBank(parts: Part[]): Pick<Bank, "topics" | "questions"> {
  const topics = new Map<string, Topic>();
  const questions = new Map<string, { topic: Topic; question: Question }>();
  parts.forEach((part) =>
    part.peaks.forEach((peak) =>
      peak.cards.forEach((topic) => {
        topics.set(String(topic.id), topic);
        topic.questions.forEach((question) => questions.set(String(question.id), { topic, question }));
      })
    )
  );
  return { topics, questions };
}

export async function load(): Promise<Bank> {
  if (cache) return cache;
  try {
    const [part1Data, part23Data, comboData, answerData] = await Promise.all([
      loadJSON(PATHS.part1),
      loadJSON(PATHS.part23),
      loadJSON(PATHS.part2Combo),
      loadJSON(PATHS.part23Answers).catch(() => ({ topics: [] })),
    ]);
    const answerMap = normalizeAnswers(answerData);
    const part1Topics = ((part1Data as any).topics || []).map((t: any) => normalizeTopic(t, 1));
    const part23Topics = withAnswers(
      ((part23Data as any).topics || []).map((t: any) => normalizeTopic(t, 2)),
      answerMap
    );
    const comboTopics = ((comboData as any).topics || []).map((t: any) => normalizeTopic(t, 4));
    const parts = makeParts(part1Topics, part23Topics, comboTopics);
    cache = { parts, ...indexBank(parts), loaded: true };
  } catch (error) {
    console.warn("Question bank fallback:", error);
    const parts = makeParts([FALLBACK_TOPICS[0]], [FALLBACK_TOPICS[1]], [FALLBACK_TOPICS[2]]);
    cache = { parts, ...indexBank(parts), loaded: false, error };
  }
  return cache;
}

export function getQuestion(
  bank: Bank,
  topicId: string,
  questionId: string,
  partName: string
): { topic: Topic; question: Question } | null {
  if (questionId && bank.questions.has(String(questionId))) return bank.questions.get(String(questionId))!;
  const topic = topicId ? bank.topics.get(String(topicId)) : null;
  const partNo = partQuestionNo(partName);
  if (!topic) {
    const part = bank.parts.find((p) => p.name === partName) || bank.parts[0];
    const firstTopic = part?.peaks[0]?.cards[0];
    if (!firstTopic) return null;
    const question = firstTopic.questions.find((q) => q.part === partNo) || firstTopic.questions[0];
    return question ? { topic: firstTopic, question } : null;
  }
  const question = topic.questions.find((q) => q.part === partNo) || topic.questions[0];
  return question ? { topic, question } : null;
}

export function splitCueCard(text: string): { title: string; bullets: string[] } {
  const clean = cleanText(text);
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
