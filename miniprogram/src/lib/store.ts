import Taro from "@tarojs/taro";
import { toPracticeQuestions, type Part, type Peak, type Topic } from "./api";

const PROGRESS_KEY = "speaker_progress";
const SETTINGS_KEY = "speaker_settings";

export interface Settings {
  targetBand: number;
  streak: number;
  name?: string;
  onboarded?: boolean;
  lastActive?: string;
}

const DEFAULT_SETTINGS: Settings = { targetBand: 6.5, streak: 0, onboarded: false };

function ymd(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function touchStreak(): Settings {
  const s = getSettings();
  const today = ymd();
  if (s.lastActive === today) return s;
  const yesterday = ymd(new Date(Date.now() - 86400000));
  const streak = s.lastActive === yesterday ? (s.streak || 0) + 1 : 1;
  return setSettings({ streak, lastActive: today });
}

// Legacy progress: "partIdx-peakIdx" -> number of lit nodes. It breaks as soon
// as the cloud bank adds, removes or reorders topics, so it is only read once
// to migrate and is never written again.
export function getProgress(): Record<string, number> {
  try {
    const value = Taro.getStorageSync(PROGRESS_KEY);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

// Lit map nodes, keyed by part name -> topic ids. Topic ids are stable across
// bank versions, so a bank update never moves a user's progress onto another
// topic.
const LIT_TOPICS_KEY = "speaker_lit_topics_v2";
const LIT_MIGRATED_KEY = "speaker_lit_topics_v2_migrated";

export type LitTopics = Record<string, string[]>;

export function getLitTopics(): LitTopics {
  try {
    const value = Taro.getStorageSync(LIT_TOPICS_KEY);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function setLitTopics(lit: LitTopics) {
  Taro.setStorageSync(LIT_TOPICS_KEY, lit);
}

export function lightTopic(partName: string, topicId: string) {
  if (!topicId) return;
  const lit = getLitTopics();
  const ids = lit[partName] || [];
  if (ids.includes(topicId)) return;
  setLitTopics({ ...lit, [partName]: [...ids, topicId] });
}

function litSet(lit: LitTopics, partName: string): Set<string> {
  return new Set(lit[partName] || []);
}

// Nodes unlock strictly in order, so the map shows the lit prefix of a peak:
// the first unlit topic is the current node and everything after it stays
// locked (even if it was lit under an older bank layout).
export function peakDoneCount(lit: LitTopics, partName: string, peak: Peak | undefined): number {
  if (!peak) return 0;
  const ids = litSet(lit, partName);
  const firstPending = peak.cards.findIndex((card) => !ids.has(String(card.id)));
  return firstPending < 0 ? peak.cards.length : firstPending;
}

// Lit topics that still exist in the current bank.
export function litCountForPart(lit: LitTopics, part: Part): number {
  const ids = litSet(lit, part.name);
  return part.peaks.reduce((sum, peak) => sum + peak.cards.filter((card) => ids.has(String(card.id))).length, 0);
}

export function topicRequirementMet(partName: string, topic: Topic, passedIds: string[]): boolean {
  const questions = toPracticeQuestions(topic, partName);
  const need = Math.min(needForPart(partName), questions.length || 1);
  const required = questions.slice(0, need);
  if (!required.length) return false;
  const passed = new Set(passedIds);
  return required.every((question) => passed.has(question.id));
}

// One-time migration from the position-based map. The per-topic flow records
// (passed question ids keyed by topic id) are already id-based and are written
// before a node is lit, so they are the reliable source; the legacy position
// map is not used because it may point at topics from an older bank.
export function migrateLegacyProgress(parts: Part[]) {
  try {
    if (Taro.getStorageSync(LIT_MIGRATED_KEY)) return;
  } catch {
    return;
  }
  if (!parts.length) return;
  const lit = getLitTopics();
  const next: LitTopics = { ...lit };
  for (const part of parts) {
    const ids = new Set(next[part.name] || []);
    for (const peak of part.peaks) {
      for (const card of peak.cards) {
        const id = String(card.id);
        if (!ids.has(id) && topicRequirementMet(part.name, card, getTopicPassed(part.name, id))) ids.add(id);
      }
    }
    if (ids.size) next[part.name] = Array.from(ids);
  }
  setLitTopics(next);
  Taro.setStorageSync(LIT_MIGRATED_KEY, 1);
}

export function topicFlowKey(partName: string, topicId: string): string {
  return `speaker_topic_flow_${partName}_${topicId}`;
}

export function getTopicPassed(partName: string, topicId: string): string[] {
  try {
    const value = Taro.getStorageSync(topicFlowKey(partName, topicId));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function setTopicPassed(partName: string, topicId: string, questionIds: string[]) {
  Taro.setStorageSync(topicFlowKey(partName, topicId), questionIds);
}

export function needForPart(partName: string): number {
  return partName === "Part 2串题" || partName.includes("串题") ? 1 : 3;
}

export function getSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...(Taro.getStorageSync(SETTINGS_KEY) || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function setSettings(next: Partial<Settings>) {
  const merged = { ...getSettings(), ...next };
  Taro.setStorageSync(SETTINGS_KEY, merged);
  return merged;
}
