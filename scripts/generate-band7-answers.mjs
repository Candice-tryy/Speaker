import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RESOURCE = path.join(ROOT, "Resource");
const CACHE_PATH = path.join(RESOURCE, "band7_answer_cache.json");

const PART1_BANK = path.join(RESOURCE, "PART1题库", "papaen_part1_current.json");
const PART1_OUT = path.join(RESOURCE, "PART1题库", "part1_band7_sample_answers.md");
const PART23_BANK = path.join(RESOURCE, "PART2&3题库", "papaen_part23_current.json");
const PART23_JSON = path.join(RESOURCE, "PART2&3题库", "part23_band7_sample_answers.json");
const PART23_MD = path.join(RESOURCE, "PART2&3题库", "part23_band7_sample_answers.md");
const PART23_CSV = path.join(RESOURCE, "PART2&3题库", "part23_band7_sample_answers.csv");
const COMBO_BANK = path.join(RESOURCE, "PART2串题题库", "papaen_part2_combo_current.json");
const COMBO_JSON = path.join(RESOURCE, "PART2串题题库", "part2_combo_band7_sample_answers.json");
const COMBO_MD = path.join(RESOURCE, "PART2串题题库", "part2_combo_band7_sample_answers.md");
const COMBO_CSV = path.join(RESOURCE, "PART2串题题库", "part2_combo_band7_sample_answers.csv");

const BASE_URL = process.env.LLM_BASE_URL || "https://api.deepseek.com/v1";
const MODEL = process.env.LLM_MODEL || "deepseek-chat";
const CONCURRENCY = Number(process.env.BANK_ANSWER_CONCURRENCY || 2);
const MAX_RETRIES = Number(process.env.BANK_ANSWER_RETRIES || 3);

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stableHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function cacheKey(topic, question) {
  const payload = [
    MODEL,
    topic.id,
    topic.title,
    question.id,
    question.part,
    cleanText(question.content),
  ].join("\n");
  return `${question.part}:${question.id}:${stableHash(payload)}`;
}

async function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    let source = "";
    try {
      source = await fs.readFile(path.join(ROOT, file), "utf8");
    } catch {
      continue;
    }
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (!process.env[key]) process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
}

function requireApiKey() {
  const key = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY;
  if (!key) {
    throw new Error(
      "Missing DEEPSEEK_API_KEY or LLM_API_KEY. bank:answers now requires a real LLM key and will not fall back to templates."
    );
  }
  return key;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function writeText(file, text) {
  await fs.writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

async function readCache() {
  try {
    const data = JSON.parse(await fs.readFile(CACHE_PATH, "utf8"));
    return data?.answers && typeof data.answers === "object" ? data : { answers: {} };
  } catch {
    return { version: 1, model: MODEL, answers: {} };
  }
}

async function writeCache(cache) {
  await writeText(
    CACHE_PATH,
    JSON.stringify(
      {
        version: 1,
        model: MODEL,
        updated_at: new Date().toISOString(),
        answers: cache.answers,
      },
      null,
      2
    )
  );
}

function systemPrompt(part) {
  const base =
    "You are an IELTS Speaking coach writing authentic Band 7 sample answers. " +
    "Answer the exact prompt, stay specific to the question, and avoid memorised boilerplate. " +
    "Use natural spoken English, not bullet points. Do not mention that you are an AI.";
  if (part === 1) {
    return `${base} For Part 1, write 45-65 words: direct answer, one reason, one concrete detail, natural close.`;
  }
  if (part === 2) {
    return `${base} For Part 2, write 150-190 words in 3-4 short paragraphs. Cover the cue card details and include a clear feeling/reflection.`;
  }
  if (part === 3) {
    return `${base} For Part 3, write 80-115 words: opinion, reason, specific example, contrast or limitation, balanced close.`;
  }
  return `${base} This is a reusable Part 2 combo card. Write 150-190 words tailored to the actual cue card, with a flexible story that can be adapted but is not identical across topics.`;
}

function userPrompt(topic, question) {
  return [
    `Topic: ${topic.title}`,
    `Question ID: ${question.id}`,
    `IELTS part: ${question.part === 4 ? "Part 2 combo" : `Part ${question.part}`}`,
    `Prompt: ${cleanText(question.content)}`,
    "",
    "Write only the sample answer. It must directly answer this prompt, include concrete nouns/actions, and avoid generic claims like 'daily habits reveal values' unless the prompt is actually about habits.",
  ].join("\n");
}

function maxTokensFor(part) {
  if (part === 1) return 140;
  if (part === 3) return 220;
  return 420;
}

function invalidAnswerReason(answer) {
  if (!cleanText(answer)) return "empty answer";
  if (/as an ai|i cannot|i'm unable/i.test(answer)) return "model refusal";
  if (/\b(here\s+is|here[’']s)\s+(a\s+)?(sample|flexible|band\s*7|ielts|part\s*[123])\s+answer\b/i.test(answer)) {
    return "meta sample-answer framing";
  }
  if (/\b(sample answer|fits the (?:cue card|prompt|topics)|topics you mentioned|below is)\b/i.test(answer)) {
    return "meta explanation";
  }
  return "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callLlm(apiKey, topic, question) {
  const body = {
    model: MODEL,
    temperature: 0.75,
    max_tokens: maxTokensFor(question.part),
    messages: [
      { role: "system", content: systemPrompt(question.part) },
      { role: "user", content: userPrompt(topic, question) },
    ],
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`LLM ${res.status}: ${text.slice(0, 500)}`);
      const data = JSON.parse(text);
      const answer = cleanText(data?.choices?.[0]?.message?.content || "").replace(/^["']|["']$/g, "");
      const invalidReason = invalidAnswerReason(answer);
      if (invalidReason) throw new Error(`Invalid answer (${invalidReason}): ${answer}`);
      return answer;
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      await sleep(750 * attempt);
    }
  }
  throw new Error("Unreachable LLM retry state");
}

function visibleQuestions(topic) {
  return (topic.questions || []).filter((question) => question.is_show !== 0 && cleanText(question.content));
}

function makeTaskList(...banks) {
  const tasks = [];
  banks.forEach((bank) => {
    (bank.topics || []).forEach((topic) => {
      if (topic.is_show === 0) return;
      visibleQuestions(topic).forEach((question) => tasks.push({ topic, question }));
    });
  });
  return tasks;
}

async function generateAnswers(tasks, cache, apiKey) {
  let generated = 0;
  let reused = 0;
  let cursor = 0;
  const total = tasks.length;

  async function worker(workerId) {
    while (cursor < total) {
      const index = cursor;
      cursor += 1;
      const { topic, question } = tasks[index];
      const key = cacheKey(topic, question);
      const cached = cache.answers[key]?.answer;
      if (cached && !invalidAnswerReason(cached)) {
        reused += 1;
        continue;
      }
      const answer = await callLlm(apiKey, topic, question);
      cache.answers[key] = {
        question_id: String(question.id),
        part: question.part,
        topic_id: String(topic.id),
        topic_title: cleanText(topic.title),
        question: cleanText(question.content),
        answer,
        model: MODEL,
        generated_at: new Date().toISOString(),
      };
      generated += 1;
      if (generated % 10 === 0 || generated === 1) {
        console.log(`Generated ${generated}, reused ${reused}, processed ${index + 1}/${total} (worker ${workerId})`);
        await writeCache(cache);
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, (_, index) => worker(index + 1));
  await Promise.all(workers);
  await writeCache(cache);
  return { generated, reused, total };
}

function answerFor(cache, topic, question) {
  return cache.answers[cacheKey(topic, question)]?.answer || "";
}

function makeAnswerJson(bank, basedOn, cache) {
  return {
    based_on: basedOn,
    generated_at: new Date().toISOString(),
    generator: {
      type: "llm",
      provider: BASE_URL,
      model: MODEL,
      cache: path.relative(ROOT, CACHE_PATH),
    },
    standard: {
      target_band: "IELTS Speaking Band 7",
      part1: "Direct answer, reason, concrete detail, natural close.",
      part2: "Cue-card answer with clear context, required details, development, feeling, and reflection.",
      part3: "Discussion answer with opinion, reason, example or extension, contrast, and balanced close.",
      part2_combo: "Adaptable story tailored to the real cue card, not a fixed universal story.",
    },
    topics: (bank.topics || [])
      .filter((topic) => topic.is_show !== 0)
      .map((topic) => ({
        index: topic.index,
        id: topic.id,
        title: topic.title,
        tag_id: topic.tag_id,
        tag_name: topic.tag_name,
        is_new: topic.is_new,
        answers: visibleQuestions(topic).map((question) => ({
          question_index: question.index,
          question_id: question.id,
          part: question.part,
          question: question.content,
          answer: answerFor(cache, topic, question),
        })),
      })),
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function answersToCsv(data) {
  const rows = [["topic_index", "topic_id", "topic_title", "question_index", "question_id", "part", "question", "answer"]];
  data.topics.forEach((topic) => {
    topic.answers.forEach((item) => {
      rows.push([topic.index, topic.id, topic.title, item.question_index, item.question_id, item.part, item.question, item.answer]);
    });
  });
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

function answersToMarkdown(data, title) {
  const lines = [
    `# ${title}`,
    "",
    `- Based on: ${data.based_on}`,
    `- Generated at: ${data.generated_at}`,
    `- Generator: ${data.generator.model} via ${data.generator.provider}`,
    `- Cache: ${data.generator.cache}`,
    `- Target: ${data.standard.target_band}`,
    "",
  ];
  data.topics.forEach((topic) => {
    lines.push(`## ${topic.index}. ${topic.title}`);
    lines.push("");
    topic.answers.forEach((item) => {
      lines.push(`### Q${item.question_index}. ${item.question}`);
      lines.push("");
      lines.push(item.answer);
      lines.push("");
    });
  });
  return lines.join("\n");
}

function part1Markdown(bank, cache) {
  const lines = [
    "# IELTS Speaking Part 1 Band 7 Sample Answers",
    "",
    "- Source file: papaen_part1_current.json",
    `- Topic count: ${bank.topic_count}`,
    `- Question count: ${bank.question_count}`,
    `- Generated at: ${new Date().toISOString()}`,
    `- Generator: ${MODEL} via ${BASE_URL}`,
    `- Cache: ${path.relative(ROOT, CACHE_PATH)}`,
    "",
    "Note: These answers are pre-generated with an LLM and should be personalised before memorising or practising.",
    "",
  ];
  (bank.topics || [])
    .filter((topic) => topic.is_show !== 0)
    .forEach((topic) => {
      lines.push(`## ${topic.index}. ${topic.title}`);
      lines.push(`- Tag: ${topic.tag_name || ""}`);
      lines.push(`- Status: ${topic.is_new === 1 ? "NEW" : "CURRENT"}`);
      lines.push("");
      visibleQuestions(topic).forEach((question) => {
        lines.push(`### Q${question.index}. ${question.content}`);
        lines.push("");
        lines.push(answerFor(cache, topic, question));
        lines.push("");
      });
    });
  return lines.join("\n");
}

async function main() {
  await loadEnvFiles();
  const apiKey = requireApiKey();
  const [part1, part23, combo, cache] = await Promise.all([
    readJson(PART1_BANK),
    readJson(PART23_BANK),
    readJson(COMBO_BANK),
    readCache(),
  ]);

  const tasks = makeTaskList(part1, part23, combo);
  const stats = await generateAnswers(tasks, cache, apiKey);

  const part23Answers = makeAnswerJson(part23, "papaen_part23_current.json", cache);
  const comboAnswers = makeAnswerJson(combo, "papaen_part2_combo_current.json", cache);

  await writeText(PART1_OUT, part1Markdown(part1, cache));
  await writeText(PART23_JSON, JSON.stringify(part23Answers, null, 2));
  await writeText(PART23_MD, answersToMarkdown(part23Answers, "IELTS Speaking Part 2&3 Band 7 Sample Answers"));
  await writeText(PART23_CSV, answersToCsv(part23Answers));
  await writeText(COMBO_JSON, JSON.stringify(comboAnswers, null, 2));
  await writeText(COMBO_MD, answersToMarkdown(comboAnswers, "IELTS Speaking Part 2 Combo Band 7 Sample Answers"));
  await writeText(COMBO_CSV, answersToCsv(comboAnswers));

  console.table([
    { module: "All", total: stats.total, generated: stats.generated, reused: stats.reused, cache: path.relative(ROOT, CACHE_PATH) },
    { module: "Part 1", topics: part1.topic_count, output: path.relative(ROOT, PART1_OUT) },
    { module: "Part 2&3", topics: part23Answers.topics.length, output: path.relative(ROOT, PART23_JSON) },
    { module: "Part 2 combo", topics: comboAnswers.topics.length, output: path.relative(ROOT, COMBO_JSON) },
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
