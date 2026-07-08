export interface Question {
  id: string;
  index?: number;
  part: number;
  content: string;
  is_show?: number;
  answer?: string;
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

export interface Bank {
  parts: Part[];
  topics: Map<string, Topic>;
  questions: Map<string, { topic: Topic; question: Question }>;
  loaded: boolean;
  error?: unknown;
}

// Duplicated in miniprogram/src/lib/api.ts (ScoreResult) — the mini program can't
// import from outside its own package. Keep the two shapes in sync when changing
// what /api/score or /api/speaking-score returns.
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

export interface SpeakingScoreResult {
  transcript: string;
  overall: number;
  fluencyCoherence: number;
  lexicalResource: number;
  grammar: number;
  pronunciation: number;
  advice: string;
  evidence: string[];
  source?: {
    asr: "iflytek" | "mock";
    scorer: "deepseek" | "mock";
  };
  rejected?: boolean;
}

export interface IseScores {
  total?: number;
  accuracy?: number;
  fluency?: number;
  standard?: number;
  integrity?: number;
  rejected?: boolean;
}
