import type { IseScores } from "./types";

// ISE English (en_vip) returns dimension scores on a 0–5 scale. Map to an IELTS
// band (0–9), rounded to the nearest 0.5. This is a placeholder linear mapping —
// calibrate against real takes once we have data (this is the whole point of the
// vertical slice: check that scores are stable and believable).
const ISE_MAX = 5;

function toBand(score: number | undefined): number | undefined {
  if (score == null || Number.isNaN(score)) return undefined;
  const raw = (score / ISE_MAX) * 9;
  return Math.max(0, Math.min(9, Math.round(raw * 2) / 2));
}

export interface MappedScore {
  band: number;
  pronunciation: number;
  fluency: number;
}

export function mapIseToBand(scores: IseScores): MappedScore {
  const pronunciation = toBand(scores.standard) ?? toBand(scores.accuracy) ?? toBand(scores.total) ?? 6;
  const fluency = toBand(scores.fluency) ?? toBand(scores.total) ?? 6;
  const band = toBand(scores.total) ?? Math.round(((pronunciation + fluency) / 2) * 2) / 2;
  return { band, pronunciation, fluency };
}
