import Taro from "@tarojs/taro";

const PROGRESS_KEY = "speaker_progress";
const SETTINGS_KEY = "speaker_settings";

export interface Settings {
  targetBand: number;
  streak: number;
  name?: string;
  onboarded?: boolean;
  lastActive?: string;
}

const DEFAULT_SETTINGS: Settings = { targetBand: 6.5, streak: 1, onboarded: false };

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

export function getProgress(): Record<string, number> {
  try {
    const value = Taro.getStorageSync(PROGRESS_KEY);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function setProgress(progress: Record<string, number>) {
  Taro.setStorageSync(PROGRESS_KEY, progress);
}

export function peakKey(partIdx: number, peakIdx: number): string {
  return `${partIdx}-${peakIdx}`;
}

export function getPeakDone(partIdx: number, peakIdx: number): number {
  return Math.max(0, Number(getProgress()[peakKey(partIdx, peakIdx)] || 0));
}

export function lightMapNode(partIdx: number, peakIdx: number, nodeIdx: number) {
  const progress = getProgress();
  const key = peakKey(partIdx, peakIdx);
  const nextDone = nodeIdx + 1;
  if ((progress[key] ?? 0) < nextDone) {
    setProgress({ ...progress, [key]: nextDone });
  }
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
