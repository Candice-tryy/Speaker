import { promises as fs } from "fs";
import path from "path";
import type { Bank, Part, Peak, Question, Topic } from "./types";

const RESOURCE = path.join(process.cwd(), "Resource");
const PATHS = {
  part1: path.join(RESOURCE, "PART1\u9898\u5e93", "papaen_part1_current.json"),
  part1Answers: path.join(RESOURCE, "PART1\u9898\u5e93", "part1_band7_sample_answers.md"),
  part23: path.join(RESOURCE, "PART2&3\u9898\u5e93", "papaen_part23_current.json"),
  part23Answers: path.join(RESOURCE, "PART2&3\u9898\u5e93", "part23_band7_sample_answers.json"),
  part2Combo: path.join(RESOURCE, "PART2\u4e32\u9898\u9898\u5e93", "papaen_part2_combo_current.json"),
  part2ComboAnswers: path.join(RESOURCE, "PART2\u4e32\u9898\u9898\u5e93", "part2_combo_band7_sample_answers.json"),
};

export const PART2_COMBO = "Part 2\u4e32\u9898";

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

async function loadText(file: string): Promise<string> {
  return fs.readFile(file, "utf8");
}

function cleanText(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function answerKey(text: unknown): string {
  return cleanText(text).toLowerCase();
}

function parsePart1MarkdownAnswers(markdown: string): Map<string, string> {
  const out = new Map<string, string>();
  const text = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const heading = /^###\s+Q\d+\.\s+(.+?)\s*$/gm;
  const matches = Array.from(text.matchAll(heading));

  matches.forEach((match, index) => {
    const question = cleanText(match[1]);
    const bodyStart = (match.index || 0) + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? text.indexOf("\n## ", bodyStart);
    const rawAnswer = text.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd).trim();
    const answer = cleanText(rawAnswer);
    if (question && answer) out.set(answerKey(question), answer);
  });

  return out;
}

function normalizeTopic(topic: any, partHint: number, answerByContent = new Map<string, string>()): Topic {
  const questions: Question[] = (topic.questions || [])
    .filter((q: any) => q.is_show !== 0)
    .map((q: any) => ({
      id: String(q.id),
      index: q.index,
      part: q.part || partHint,
      content: cleanText(q.content),
      is_show: q.is_show,
      answer: answerByContent.get(answerKey(q.content)) || cleanText(q.answers?.[0]?.content),
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

const ANSWER_FIT_STOPWORDS = new Set(
  ("the a an of to in on at for and or but is are was were be been being do does did done you your yours i my me mine " +
    "we our ours they their theirs he she it its this that these those there here what when where which who whom whose " +
    "why how think thing things people person often usually really very much many more most some any all with without " +
    "about would could should shall will can may might must have has had having not no yes than then also just like get " +
    "make made take took time way day good important because while still even other others such into from out over").split(/\s+/)
);

function keywordSet(text: unknown): Set<string> {
  return new Set(
    cleanText(text)
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !ANSWER_FIT_STOPWORDS.has(word))
  );
}

function questionAnswerFit(question: unknown, answerWords: Set<string>): number {
  const questionWords = keywordSet(question);
  if (!questionWords.size) return 0;
  let hits = 0;
  questionWords.forEach((word) => {
    if (answerWords.has(word)) hits += 1;
  });
  return hits / questionWords.size;
}

function normalizeAnswers(data: any, options: { includeParts?: number[] } = {}): Map<string, string> {
  const includeParts = options.includeParts ? new Set(options.includeParts) : null;
  const out = new Map<string, string>();
  (data?.topics || []).forEach((topic: any) => {
    const siblings: any[] = topic.answers || [];
    siblings.forEach((item: any) => {
      if (includeParts && !includeParts.has(Number(item.part))) return;
      // The generated sample-answer file sometimes attaches an answer body that
      // actually discusses a sibling question from the same topic. Only keep an
      // answer when no sibling question fits its body better than its own.
      const answerWords = keywordSet(item.answer);
      const ownFit = questionAnswerFit(item.question, answerWords);
      const misassigned = siblings.some(
        (other: any) => other !== item && questionAnswerFit(other.question, answerWords) > ownFit
      );
      if (misassigned) return;
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

export function isTopicNodePart(partName: string): boolean {
  return partName === "Part 1" || partName === "Part 2&3" || partName === PART2_COMBO;
}

function nodesPerPeak(partName: string): number {
  return partName === PART2_COMBO ? 4 : isTopicNodePart(partName) ? 7 : 3;
}

export function partQuestionNo(partName: string): number {
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
    const [part1Data, part1AnswerText, part23Data, comboData, answerData, comboAnswerData] = await Promise.all([
      loadJSON(PATHS.part1),
      loadText(PATHS.part1Answers).catch(() => ""),
      loadJSON(PATHS.part23),
      loadJSON(PATHS.part2Combo),
      loadJSON(PATHS.part23Answers).catch(() => ({ topics: [] })),
      loadJSON(PATHS.part2ComboAnswers).catch(() => ({ topics: [] })),
    ]);
    const answerMap = normalizeAnswers(answerData);
    const comboAnswerMap = normalizeAnswers(comboAnswerData, { includeParts: [4] });
    const part1AnswerMap = parsePart1MarkdownAnswers(part1AnswerText);
    const part1Topics = ((part1Data as any).topics || []).map((t: any) => normalizeTopic(t, 1, part1AnswerMap));
    const part23Topics = withAnswers(
      ((part23Data as any).topics || []).map((t: any) => normalizeTopic(t, 2)),
      answerMap
    );
    const comboTopics = withAnswers(
      ((comboData as any).topics || []).map((t: any) => normalizeTopic(t, 4)),
      comboAnswerMap
    );
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

// No fabricated fallback: an invented "balance" boilerplate reads like a
// mismatched answer on the card. Empty means the UI shows a "no sample yet"
// placeholder instead.
export function fallbackAnswer(question: Question | undefined, _topic: Topic | undefined): string {
  return question?.answer || "";
}

export interface PracticeQuestion extends Question {
  qtext: string;
  bullets: string[];
  answer: string;
}

export function toPracticeQuestion(question: Question, topic: Topic): PracticeQuestion {
  if (question.part === 4) {
    return {
      ...question,
      qtext: topic.title,
      bullets: [question.content],
      answer: fallbackAnswer(question, topic),
    };
  }
  if (question.part === 2) {
    const cue = splitCueCard(question.content);
    return {
      ...question,
      qtext: cue.title || question.content,
      bullets: cue.bullets.length ? cue.bullets : [topic.title],
      answer: fallbackAnswer(question, topic),
    };
  }
  return {
    ...question,
    qtext: question.content,
    bullets: [topic.title],
    answer: fallbackAnswer(question, topic),
  };
}

export function toPracticeQuestions(topic: Topic, partName: string): PracticeQuestion[] {
  const partNo = partQuestionNo(partName);
  return topic.questions
    .filter((q) => q.is_show !== 0)
    .filter((q) => (partName === "Part 2&3" ? q.part === 2 || q.part === 3 : q.part === partNo))
    .map((q) => toPracticeQuestion(q, topic));
}
