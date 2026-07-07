import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RESOURCE = path.join(ROOT, "Resource");
const API_PATH = "/v2/exercise/material_parts";
const API_SOURCE = `https://napi.papaen.com${API_PATH}`;
const SOURCE_PAGE = "https://ielts.papaen.com/center/speaking?ielts-speaking=%2Fspeaking_materials%2Findex";
const SIGN_SALT = "3c4c4a76abdfe223fe9bebc2fd1ddb71";
const AES_KEY = Buffer.from("m7Ejf*Po*RQpg!hX8J!Yo_G2.sVtga28", "utf8");

const TAG_NAMES = new Map([
  [18, "人物"],
  [19, "事物"],
  [20, "事件"],
  [21, "地点"],
]);

const TARGETS = [
  {
    module: 1,
    baseName: "papaen_part1",
    dir: path.join(RESOURCE, "PART1题库"),
    urlField: "part1_file_url",
    title: "Part 1",
  },
  {
    module: 2,
    baseName: "papaen_part23",
    dir: path.join(RESOURCE, "PART2&3题库"),
    urlField: "part23_file_url",
    title: "Part 2&3",
  },
  {
    module: 3,
    baseName: "papaen_part2_combo",
    dir: path.join(RESOURCE, "PART2串题题库"),
    urlField: "part2_combo_file_url",
    title: "Part 2串题",
  },
];

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function signParams(pathname, params = {}) {
  const payload = {
    platform: "web",
    version: "1.0.0",
    "user-agent": "Mozilla/5.0",
    "app-name": "papaielts",
    ...params,
    path: pathname,
  };
  const keys = Object.keys(payload).sort();
  let raw = "";
  keys.forEach((key, index) => {
    raw += `${key}=${encodeURIComponent(payload[key])}`;
    raw += index === keys.length - 1 ? SIGN_SALT : "&";
  });
  raw = raw.replaceAll("(", "%28").replaceAll(")", "%29").replaceAll("'", "%27").replaceAll("!", "%21");
  return crypto.createHash("md5").update(raw).digest("hex");
}

async function fetchMaterialParts() {
  const timestamp = String(Math.ceil(Date.now() / 1000));
  const response = await fetch(API_SOURCE, {
    headers: {
      channel: "papaedu",
      platform: "web",
      version: "1.0.0",
      "app-name": "papaielts",
      sign: signParams(API_PATH),
      timestamp,
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch material parts: ${response.status}`);
  const json = await response.json();
  return json.data || [];
}

async function fetchEncryptedFile(fileUrl) {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to fetch ${fileUrl}: ${response.status}`);
  const encoded = await response.text();
  const wrapper = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  const decipher = crypto.createDecipheriv("aes-256-cbc", AES_KEY, Buffer.from(wrapper.iv, "utf8"));
  let decrypted = decipher.update(wrapper.value, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

function normalizeTopic(topic, index, options = {}) {
  const questions = (topic.sub_questions || [])
    .map((question, questionIndex) => ({
      index: questionIndex + 1,
      id: question.id,
      part: question.part,
      content: cleanText(question.content),
      is_show: question.is_show,
    }))
    .filter((question) => question.content);

  const normalized = {
    index: index + 1,
    id: topic.id,
    title: cleanText(topic.title),
    tag_id: topic.tag,
    tag_name: TAG_NAMES.get(Number(topic.tag)) || "",
    level: topic.level,
    is_new: topic.is_new,
    is_show: topic.is_show,
    updated_at: topic.updated_at,
    question_count: questions.length,
    questions,
  };
  if (options.preserveSourcePayload) {
    normalized.source_payload = topic;
  }
  return normalized;
}

function makeBank({ target, moduleInfo, topics, scope }) {
  const scopedTopics = scope === "current" ? topics.filter((topic) => topic.is_show !== 0) : topics;
  const normalizedTopics = scopedTopics.map((topic, index) =>
    normalizeTopic(topic, index, { preserveSourcePayload: scope === "archive" })
  );
  const questionCount = normalizedTopics.reduce((sum, topic) => sum + topic.questions.length, 0);
  return {
    source_page: SOURCE_PAGE,
    api_source: API_SOURCE,
    [target.urlField]: moduleInfo.file_url,
    module_title: moduleInfo.title,
    module_version: moduleInfo.version,
    exported_at: new Date().toISOString(),
    notes:
      scope === "current"
        ? "current includes topics with is_show=1; question records are preserved and can still be filtered by question is_show at runtime. Source answer/audio payloads are not included."
        : "archive includes all decrypted records from the source file. Normalized question records are provided for lookup, and source_payload preserves original answer/audio fields when present.",
    topic_count: normalizedTopics.length,
    question_count: questionCount,
    topics: normalizedTopics,
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(bank) {
  const rows = [["topic_index", "topic_id", "topic_title", "tag_id", "tag_name", "level", "is_new", "topic_is_show", "question_index", "question_id", "part", "question_is_show", "content"]];
  bank.topics.forEach((topic) => {
    topic.questions.forEach((question) => {
      rows.push([
        topic.index,
        topic.id,
        topic.title,
        topic.tag_id,
        topic.tag_name,
        topic.level,
        topic.is_new,
        topic.is_show,
        question.index,
        question.id,
        question.part,
        question.is_show,
        question.content,
      ]);
    });
  });
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

function toMarkdown(bank, label) {
  const lines = [
    `# Papaen IELTS Speaking ${bank.module_title} ${label}`,
    "",
    `- Topic count: ${bank.topic_count}`,
    `- Question count: ${bank.question_count}`,
    `- Source version: ${bank.module_version}`,
    `- Exported at: ${bank.exported_at}`,
    "",
  ];
  bank.topics.forEach((topic) => {
    const flags = [topic.tag_name, topic.is_new === 1 ? "NEW" : "", topic.is_show === 0 ? "HIDDEN" : ""].filter(Boolean);
    lines.push(`## ${topic.index}. ${topic.title}${flags.length ? ` / ${flags.join(" / ")}` : ""}`);
    topic.questions.forEach((question) => {
      const hidden = question.is_show === 0 ? " / HIDDEN" : "";
      lines.push(`${question.index}. [Part ${question.part}${hidden}] ${question.content}`);
    });
    lines.push("");
  });
  return lines.join("\n");
}

async function writeBank(target, scope, bank) {
  const base = `${target.baseName}_${scope}`;
  await fs.mkdir(target.dir, { recursive: true });
  await fs.writeFile(path.join(target.dir, `${base}.json`), `${JSON.stringify(bank, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(target.dir, `${base}.csv`), toCsv(bank), "utf8");
  await fs.writeFile(path.join(target.dir, `${base}.md`), toMarkdown(bank, scope === "current" ? "Current" : "Archive"), "utf8");
}

async function main() {
  const materialParts = await fetchMaterialParts();
  const results = [];
  for (const target of TARGETS) {
    const moduleInfo = materialParts.find((item) => item.module === target.module);
    if (!moduleInfo) throw new Error(`Missing module ${target.module}`);
    const rawTopics = await fetchEncryptedFile(moduleInfo.file_url);
    const archive = makeBank({ target, moduleInfo, topics: rawTopics, scope: "archive" });
    const current = makeBank({ target, moduleInfo, topics: rawTopics, scope: "current" });
    await writeBank(target, "archive", archive);
    await writeBank(target, "current", current);
    results.push({
      module: moduleInfo.title,
      version: moduleInfo.version,
      archive_topics: archive.topic_count,
      archive_questions: archive.question_count,
      current_topics: current.topic_count,
      current_questions: current.question_count,
      file_url: moduleInfo.file_url,
    });
  }
  console.table(results);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
