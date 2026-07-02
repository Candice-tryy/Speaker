import Taro from "@tarojs/taro";

// Per-node progress + user settings, mirrored from the web prototype's
// localStorage keys but using the mini program Storage API.

const PROGRESS_KEY = "speaker_progress";
const SETTINGS_KEY = "speaker_settings";

export interface Settings {
  targetBand: number;
  streak: number;
  name?: string;
  onboarded?: boolean;
  lastActive?: string; // YYYY-MM-DD of the last day the app was opened
}

const DEFAULT_SETTINGS: Settings = { targetBand: 6.5, streak: 1, onboarded: false };

function ymd(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Update the daily streak when the app is shown: same day = no change, the
// next calendar day = +1, a gap = reset to 1.
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
    return Taro.getStorageSync(PROGRESS_KEY) || {};
  } catch {
    return {};
  }
}

// A node is keyed by part index + peak index, e.g. "1-0".
export function nodeKey(partIdx: number, peakIdx: number, nodeIdx: number): string {
  return `${partIdx}-${peakIdx}-${nodeIdx}`;
}

export function markNodeDone(key: string) {
  const p = getProgress();
  p[key] = (p[key] || 0) + 1;
  Taro.setStorageSync(PROGRESS_KEY, p);
}

export function isNodeDone(key: string, need = 1): boolean {
  return (getProgress()[key] || 0) >= need;
}

// Topic nodes light up after enough questions pass: 3 for Part 1 / Part 2&3,
// 1 for the combo (串题) part — matching the question-bank redesign.
export function needForPart(partName: string): number {
  return partName === "Part 2串题" || partName.includes("串题") || partName.includes("涓查") ? 1 : 3;
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

// One accent color per peak, rotating pink / purple / blue (design system).
const ACCENTS = [
  { acc: "#EC7CA8", deep: "#C9537F", soft: "#FBDEEA" }, // pink
  { acc: "#9B82DC", deep: "#6E54B8", soft: "#E7DEF8" }, // purple
  { acc: "#5DAEE6", deep: "#3585C2", soft: "#D7EAF9" }, // blue
];

export function accentFor(peakIdx: number) {
  return ACCENTS[peakIdx % ACCENTS.length];
}
