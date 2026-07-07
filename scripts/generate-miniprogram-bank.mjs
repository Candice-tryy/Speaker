import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RESOURCE = path.join(ROOT, "Resource");
const OUT = path.join(ROOT, "miniprogram", "src", "lib", "question-bank.generated.ts");
const OUT_JSON = path.join(ROOT, "miniprogram", "src", "assets", "question-bank.generated.json");

const PATHS = {
  part1: path.join(RESOURCE, "PART1题库", "papaen_part1_current.json"),
  part1Answers: path.join(RESOURCE, "PART1题库", "part1_band7_sample_answers.md"),
  part23: path.join(RESOURCE, "PART2&3题库", "papaen_part23_current.json"),
  part23Answers: path.join(RESOURCE, "PART2&3题库", "part23_band7_sample_answers.json"),
  combo: path.join(RESOURCE, "PART2串题题库", "papaen_part2_combo_current.json"),
  comboAnswers: path.join(RESOURCE, "PART2串题题库", "part2_combo_band7_sample_answers.json"),
};

const PART2_COMBO = "Part 2串题";

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function answerKey(value) {
  return cleanText(value).toLowerCase();
}

function parsePart1MarkdownAnswers(markdown) {
  const out = new Map();
  const text = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const heading = /^###\s+Q\d+\.\s+(.+?)\s*$/gm;
  const matches = Array.from(text.matchAll(heading));
  matches.forEach((match, index) => {
    const question = cleanText(match[1]);
    const bodyStart = (match.index || 0) + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? text.indexOf("\n## ", bodyStart);
    const answer = cleanText(text.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd));
    if (question && answer) out.set(answerKey(question), answer);
  });
  return out;
}

function normalizeAnswerJson(data, partFilter) {
  const include = partFilter ? new Set(partFilter) : null;
  const out = new Map();
  (data.topics || []).forEach((topic) => {
    (topic.answers || []).forEach((item) => {
      if (include && !include.has(Number(item.part))) return;
      out.set(String(item.question_id), cleanText(item.answer));
    });
  });
  return out;
}

function normalizeTopic(topic, partHint, answerMap, byContent = false) {
  const questions = (topic.questions || [])
    .filter((question) => question.is_show !== 0)
    .map((question) => ({
      id: String(question.id),
      index: question.index,
      part: question.part || partHint,
      content: cleanText(question.content),
      is_show: question.is_show,
      answer: byContent ? answerMap.get(answerKey(question.content)) || "" : answerMap.get(String(question.id)) || "",
    }))
    .filter((question) => question.content);

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

function shownTopics(topics) {
  return topics.filter((topic) => topic.isShow && topic.questions.length);
}

function chunk(items, size) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

function shortLabel(value, max = 18) {
  const clean = cleanText(value);
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function makePeak(topics, partName, index) {
  const cards = topics.slice(0, partName === PART2_COMBO ? 4 : 7);
  return {
    name: `Set ${index + 1}`,
    topics: cards.map((topic) => shortLabel(topic.title)),
    cards,
    boss: "Examiner",
    done: 0,
  };
}

function makeParts(part1Topics, part23Topics, comboTopics) {
  return [
    { name: "Part 1", peaks: chunk(shownTopics(part1Topics), 7).map((topics, i) => makePeak(topics, "Part 1", i)) },
    { name: "Part 2&3", peaks: chunk(shownTopics(part23Topics), 7).map((topics, i) => makePeak(topics, "Part 2&3", i)) },
    { name: PART2_COMBO, peaks: chunk(shownTopics(comboTopics), 4).map((topics, i) => makePeak(topics, PART2_COMBO, i)) },
  ];
}

function stripAnswersForBundledFallback(parts) {
  return parts.map((part) => ({
    ...part,
    peaks: part.peaks.map((peak) => ({
      ...peak,
      cards: peak.cards.map((topic) => ({
        ...topic,
        questions: topic.questions.map(({ answer, ...question }) => question),
      })),
    })),
  }));
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function main() {
  const [part1, part1AnswerText, part23, part23Answers, combo, comboAnswers] = await Promise.all([
    readJson(PATHS.part1),
    fs.readFile(PATHS.part1Answers, "utf8"),
    readJson(PATHS.part23),
    readJson(PATHS.part23Answers),
    readJson(PATHS.combo),
    readJson(PATHS.comboAnswers),
  ]);

  const part1AnswerMap = parsePart1MarkdownAnswers(part1AnswerText);
  const part23AnswerMap = normalizeAnswerJson(part23Answers);
  const comboAnswerMap = normalizeAnswerJson(comboAnswers, [4]);
  const parts = makeParts(
    (part1.topics || []).map((topic) => normalizeTopic(topic, 1, part1AnswerMap, true)),
    (part23.topics || []).map((topic) => normalizeTopic(topic, 2, part23AnswerMap)),
    (combo.topics || []).map((topic) => normalizeTopic(topic, 4, comboAnswerMap))
  );
  const questionCount = parts.reduce(
    (sum, part) => sum + part.peaks.reduce((partSum, peak) => partSum + peak.cards.reduce((peakSum, topic) => peakSum + topic.questions.length, 0), 0),
    0
  );

  const source = `// Generated by scripts/generate-miniprogram-bank.mjs. Do not edit by hand.\n` +
    `import type { Part } from "./api";\n\n` +
    `export const GENERATED_BANK_META = ${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        basedOn: {
          part1: path.basename(PATHS.part1),
          part23: path.basename(PATHS.part23),
          combo: path.basename(PATHS.combo),
        },
        questionCount,
      },
      null,
      2
    )} as const;\n\n` +
    `export const GENERATED_PARTS: Part[] = ${JSON.stringify(parts, null, 2)};\n`;

  await fs.writeFile(OUT, source, "utf8");
  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(
    OUT_JSON,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      basedOn: {
        part1: path.basename(PATHS.part1),
        part23: path.basename(PATHS.part23),
        combo: path.basename(PATHS.combo),
      },
      questionCount,
      parts: stripAnswersForBundledFallback(parts),
    })}\n`,
    "utf8"
  );
  console.table(parts.map((part) => ({
    part: part.name,
    peaks: part.peaks.length,
    topics: part.peaks.reduce((sum, peak) => sum + peak.cards.length, 0),
    questions: part.peaks.reduce((sum, peak) => sum + peak.cards.reduce((peakSum, topic) => peakSum + topic.questions.length, 0), 0),
  })));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
