import Taro from "@tarojs/taro";

// Used by scoring and explicit local bank debugging. The question bank itself
// is cloud-first and only falls back to this URL when USE_LOCAL_BANK_API=1.
// For production scoring, replace this with a whitelisted HTTPS API domain.
export const BASE_URL = "http://172.20.10.3:3000";

export interface Question {
  id: string;
  index?: number;
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
  index?: number;
  title: string;
  tag?: string;
  level?: unknown;
  isNew?: boolean;
  isShow?: boolean;
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
  source?: "iflytek" | "mock" | "deepseek";
  rejected?: boolean;
  transcript?: string;
  lexicalResource?: number;
  grammar?: number;
  evidence?: string[];
}

const BANK_CACHE_KEY = "speaker_current_bank_cache_v1";
const BANK_MANIFEST_COLLECTION = "bank_manifest";
const BANK_PARTS_COLLECTION = "bank_parts";
const ACTIVE_MANIFEST_ID = "active";
const GENERATED_FALLBACK_PATHS = [
  "assets/question-bank.generated.json",
  "/assets/question-bank.generated.json",
];

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

// No fabricated fallback: an invented "balance" boilerplate reads like a
// mismatched answer on the card. Empty means the UI shows a "no sample yet"
// placeholder instead.
export function fallbackAnswer(question: Question | undefined, _topic: Topic | undefined): string {
  return question?.answer || "";
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

function sanitizeParts(parts: Part[]): Part[] {
  return (parts || []).map((part) => ({
    ...part,
    peaks: (part.peaks || []).map((peak) => ({
      ...peak,
      cards: (peak.cards || [])
        .map((topic) => ({
          ...topic,
          questions: (topic.questions || []).filter((q) => q.is_show !== 0),
        }))
        .filter((topic) => topic.questions.length > 0),
    })).filter((peak) => peak.cards.length > 0),
  })).filter((part) => part.peaks.length > 0);
}

function readCachedBank(): Part[] | null {
  try {
    const value = Taro.getStorageSync(BANK_CACHE_KEY);
    if (value && Array.isArray(value.parts) && value.parts.length > 0) return sanitizeParts(value.parts);
  } catch {}
  return null;
}

function writeCachedBank(parts: Part[], version?: string) {
  try {
    Taro.setStorageSync(BANK_CACHE_KEY, { version, cachedAt: Date.now(), parts });
  } catch {}
}

async function getGeneratedFallbackParts(): Promise<Part[]> {
  const fs = Taro.getFileSystemManager?.();
  if (!fs) return [];
  for (const filePath of GENERATED_FALLBACK_PATHS) {
    try {
      const source = fs.readFileSync(filePath, "utf8") as string;
      const data = JSON.parse(source);
      return sanitizeParts(data.parts || []);
    } catch {}
  }
  return [];
}

async function getCloudBank(): Promise<{ parts: Part[]; version?: string } | null> {
  if (!__CLOUD_ENV_ID__) return null;
  const cloud = (Taro as any).cloud;
  if (!cloud) return null;
  if (!cloud.__speakerInited) {
    cloud.init({ env: __CLOUD_ENV_ID__, traceUser: true });
    cloud.__speakerInited = true;
  }
  const db = cloud.database();
  const manifestResult = await db.collection(BANK_MANIFEST_COLLECTION).doc(ACTIVE_MANIFEST_ID).get();
  const manifest = manifestResult?.data || {};
  const version = String(manifest.activeVersion || "");
  if (!version) return null;

  const partOrder: string[] = Array.isArray(manifest.parts) && manifest.parts.length
    ? manifest.parts
    : ["Part 1", "Part 2&3", "Part 2串题"];
  const parts: Part[] = [];
  for (const partName of partOrder) {
    const result = await db
      .collection(BANK_PARTS_COLLECTION)
      .where({ version, name: partName })
      .limit(1)
      .get();
    const part = result?.data?.[0]?.part;
    if (part?.name && Array.isArray(part.peaks)) parts.push(part);
  }
  const cleanParts = sanitizeParts(parts);
  return cleanParts.length ? { parts: cleanParts, version } : null;
}

export async function getBank(): Promise<{ parts: Part[]; loaded: boolean }> {
  try {
    const cloudBank = await getCloudBank();
    if (cloudBank?.parts?.length) {
      writeCachedBank(cloudBank.parts, cloudBank.version);
      return { parts: cloudBank.parts, loaded: true };
    }
  } catch {}

  const cached = readCachedBank();
  if (cached?.length) return { parts: cached, loaded: true };

  if (__USE_LOCAL_BANK_API__) {
    try {
      const res = await Taro.request({
        url: `${BASE_URL}/api/bank`,
        method: "GET",
        timeout: 8000,
      });
      const data = res.data as { parts?: Part[]; loaded?: boolean };
      if (Array.isArray(data.parts) && data.parts.length > 0) {
        const parts = sanitizeParts(data.parts);
        if (parts.length) return { parts, loaded: data.loaded !== false };
      }
    } catch {}
  }
  try {
    return { parts: await getGeneratedFallbackParts(), loaded: false };
  } catch {
    return { parts: [], loaded: false };
  }
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
      advice: "The scoring API is not available, so this is a demo score. Keep your pace steady and make the final sentence clearer.",
      source: "mock",
    };
  }
}

export async function scoreSpeaking(params: {
  part: string;
  question: string;
  audioBase64: string;
  durationMs?: number;
}): Promise<ScoreResult> {
  try {
    const res = await Taro.request({
      url: `${BASE_URL}/api/speaking-score`,
      method: "POST",
      timeout: 60000,
      header: { "content-type": "application/json" },
      data: {
        part: params.part,
        question: params.question,
        audio: params.audioBase64,
        durationMs: params.durationMs,
      },
    });
    const data = res.data as {
      transcript?: string;
      overall?: number;
      fluencyCoherence?: number;
      lexicalResource?: number;
      grammar?: number;
      pronunciation?: number;
      advice?: string;
      evidence?: string[];
      rejected?: boolean;
    };
    return {
      band: data.overall ?? 0,
      pronunciation: data.pronunciation ?? 0,
      fluency: data.fluencyCoherence ?? 0,
      advice: data.advice || "评分暂时不可用，请重试。",
      source: "deepseek",
      rejected: data.rejected,
      transcript: data.transcript,
      lexicalResource: data.lexicalResource,
      grammar: data.grammar,
      evidence: data.evidence,
    };
  } catch {
    return {
      band: 0,
      pronunciation: 0,
      fluency: 0,
      advice: "模拟评分服务暂时不可用，请重试。",
      source: "deepseek",
      rejected: true,
    };
  }
}
