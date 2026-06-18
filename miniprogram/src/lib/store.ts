import Taro from "@tarojs/taro";

// Per-node progress + user settings, mirrored from the web prototype's
// localStorage keys but using the mini program Storage API.

const PROGRESS_KEY = "speaker_progress";
const SETTINGS_KEY = "speaker_settings";

export interface Settings {
  targetBand: number;
  streak: number;
}

const DEFAULT_SETTINGS: Settings = { targetBand: 6.5, streak: 1 };

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
