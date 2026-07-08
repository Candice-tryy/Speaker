"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ScoreResult, SpeakingScoreResult } from "@/lib/types";
import { PcmRecorder } from "@/lib/recorder";
import styles from "./card.module.css";

const MAP_PROGRESS_KEY = "speaker_progress";

export interface CardData {
  part: string;
  crumb: string;
  qtext: string;
  bullets: string[];
  answer: string;
  topicId: string;
  questionId: string;
  questions: Array<{ id: string; part: number; content: string; qtext: string; bullets: string[]; answer: string }>;
  currentIndex: number;
  loaded: boolean;
  p: string;
  pk: string;
  n: string;
}

type Mode = "follow" | "mock";

interface WordInfo {
  word: string;
  ipa: string;
  def: string;
  colloc: string;
}

// Lightweight placeholder highlight word list (ported from the prototype).
// Later this is replaced by AI-picked / preprocessed key collocations.
const DEFS: Array<[string, string, string]> = [
  ["in my opinion", "表达观点", "In my opinion, ..."],
  ["the key point", "关键点", "the key point is balance"],
  ["for example", "举例", "For example, ..."],
  ["as a result", "结果", "As a result, ..."],
  ["on the other hand", "另一方面", "On the other hand, ..."],
];

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Match {
  start: number;
  end: number;
  text: string;
  def: string;
  colloc: string;
}

function highlightAnswer(answer: string, onWord: (info: WordInfo) => void): ReactNode[] {
  const matches: Match[] = [];
  for (const [word, def, colloc] of DEFS) {
    const re = new RegExp(`\\b${escapeReg(word)}\\b`, "i");
    const m = re.exec(answer);
    if (m) matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], def, colloc });
  }
  matches.sort((a, b) => a.start - b.start);

  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < matches.length; i++) {
    const mt = matches[i];
    if (mt.start < cursor) continue; // skip overlaps
    if (mt.start > cursor) nodes.push(answer.slice(cursor, mt.start));
    nodes.push(
      <span
        key={`w-${i}`}
        className={styles.w}
        onClick={() => onWord({ word: mt.text, ipa: "", def: mt.def, colloc: mt.colloc })}
      >
        {mt.text}
      </span>
    );
    cursor = mt.end;
  }
  if (cursor < answer.length) nodes.push(answer.slice(cursor));
  return nodes;
}

export default function CardPractice({ card }: { card: CardData }) {
  const router = useRouter();

  const [target, setTarget] = useState(6.5);
  const [revealOpen, setRevealOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("follow");
  const [qIndex, setQIndex] = useState(Math.max(0, card.currentIndex));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);

  const [fb, setFb] = useState<ScoreResult | null>(null);
  const [fbOpen, setFbOpen] = useState(false);

  const [word, setWord] = useState<WordInfo | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const holdingRef = useRef(false);
  const recitedRef = useRef(false);
  const modeRef = useRef<Mode>("follow");
  const recorderRef = useRef<PcmRecorder | null>(null);
  const recStartAtRef = useRef(0);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const isTopicFlow = (card.part === "Part 1" || card.part === "Part 2&3" || card.part === "Part 2串题") && card.questions.length > 0;
  const requiredPassCount = card.part === "Part 2串题" ? 1 : Math.min(3, card.questions.length);
  const activeQuestion = useMemo(
    () =>
      isTopicFlow
        ? card.questions[Math.min(qIndex, card.questions.length - 1)] || card.questions[0]
        : { id: card.questionId, part: card.part === "Part 3" ? 3 : card.part === "Part 2串题" ? 4 : 2, content: card.qtext, qtext: card.qtext, bullets: card.bullets, answer: card.answer },
    [isTopicFlow, card.questions, card.questionId, card.part, card.qtext, card.bullets, card.answer, qIndex]
  );
  const currentAnswer = activeQuestion?.answer || card.answer;
  const currentText = activeQuestion?.qtext || activeQuestion?.content || card.qtext;
  const scoreRefText = currentAnswer || activeQuestion?.content || currentText;
  const currentBullets = isTopicFlow ? activeQuestion?.bullets || [card.crumb] : card.bullets;
  const progressKey = `speaker_topic_flow_${card.part}_${card.topicId}`;
  const firstPassQuestions = card.questions.slice(0, requiredPassCount);
  const [part1DoneCount, setPart1DoneCount] = useState(() => {
    if (typeof window === "undefined" || (card.part !== "Part 1" && card.part !== "Part 2&3" && card.part !== "Part 2串题")) return 0;
    try {
      const done = JSON.parse(localStorage.getItem(`speaker_topic_flow_${card.part}_${card.topicId}`) || "[]") as string[];
      const firstThree = new Set(firstPassQuestions.map((q) => q.id));
      return done.filter((id) => firstThree.has(id)).length;
    } catch {
      return 0;
    }
  });
  const [passedQuestionIds, setPassedQuestionIds] = useState<string[]>(() => {
    if (typeof window === "undefined" || (card.part !== "Part 1" && card.part !== "Part 2&3" && card.part !== "Part 2串题")) return [];
    try {
      return JSON.parse(localStorage.getItem(`speaker_topic_flow_${card.part}_${card.topicId}`) || "[]") as string[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const id = window.setTimeout(() => {
      const stored = parseFloat(localStorage.getItem("speaker_target") || "6.5");
      if (!Number.isNaN(stored)) setTarget(stored);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const passMark = (target - 0.5).toFixed(1);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }, []);

  const submitScore = useCallback(
    async (audio: string) => {
      setScoring(true);
      try {
        const isMockAnswer = modeRef.current === "mock";
        const res = await fetch(isMockAnswer ? "/api/speaking-score" : "/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isMockAnswer
              ? {
                  part: card.part,
                  question: activeQuestion?.content || currentText,
                  audio,
                  durationMs: recStartAtRef.current ? Date.now() - recStartAtRef.current : undefined,
                }
              : {
                  mode: modeRef.current,
                  recited: recitedRef.current,
                  refText: scoreRefText,
                  audio,
                }
          ),
        });
        if (isMockAnswer) {
          const data: SpeakingScoreResult = await res.json();
          setFb({
            band: data.overall,
            pronunciation: data.pronunciation,
            fluency: data.fluencyCoherence,
            advice: data.advice,
            source: data.source?.scorer === "deepseek" ? "deepseek" : "mock",
            rejected: data.rejected,
            transcript: data.transcript,
            lexicalResource: data.lexicalResource,
            grammar: data.grammar,
            evidence: data.evidence,
          });
        } else {
          const data: ScoreResult = await res.json();
          setFb(data);
        }
        setFbOpen(true);
        recitedRef.current = true;
      } catch {
        showToast("评分服务暂时不可用，请重试");
      } finally {
        setScoring(false);
      }
    },
    [activeQuestion, card.part, currentText, showToast, scoreRefText]
  );

  // Clean up the mic if the user navigates away mid-recording.
  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
    };
  }, []);

  async function startRec() {
    if (holdingRef.current || scoring) return;
    holdingRef.current = true;
    recStartAtRef.current = Date.now();
    setRecording(true);
    setVoiceLevel(0);
    const recorder = new PcmRecorder();
    try {
      await recorder.start(setVoiceLevel);
      // If the user stopped during the permission prompt, drop it.
      if (!holdingRef.current) {
        recorder.cancel();
        return;
      }
      recorderRef.current = recorder;
    } catch {
      recorder.cancel();
      holdingRef.current = false;
      setRecording(false);
      setVoiceLevel(0);
      // No mic / permission denied: recording is unavailable, but the take still
      // submits (server falls back to mock when no audio).
      void submitScore("");
    }
  }

  async function stopRec() {
    if (!holdingRef.current || scoring) return;
    holdingRef.current = false;
    setRecording(false);
    setVoiceLevel(0);
    let audio = "";
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      try {
        audio = await recorder.stop();
      } catch {
        audio = "";
      }
    }
    void submitScore(audio);
  }

  function toggleRecording() {
    if (recording) {
      void stopRec();
      return;
    }
    void startRec();
  }

  function changeMode(next: Mode) {
    setMode(next);
    modeRef.current = next;
    if (next === "mock") setRevealOpen(false);
  }

  function openWord(info: WordInfo) {
    setWord(info);
    setSheetOpen(true);
  }

  function changeQuestion(next: number) {
    if (!isTopicFlow) return;
    const bounded = Math.max(0, Math.min(next, card.questions.length - 1));
    setQIndex(bounded);
    window.history.replaceState(null, "", questionHref(bounded));
    setPickerOpen(false);
    setRevealOpen(true);
    setFb(null);
    setFbOpen(false);
    recitedRef.current = false;
  }

  function toggleReveal() {
    setRevealOpen((open) => !open);
  }

  function questionHref(next: number): string {
    const bounded = Math.max(0, Math.min(next, card.questions.length - 1));
    const question = card.questions[bounded];
    const params = new URLSearchParams({
      p: card.p || "1",
      pk: card.pk || "0",
      n: card.n || "0",
      part: card.part,
      topic: card.crumb,
      topicId: card.topicId,
      questionId: question?.id || card.questionId,
    });
    return `/practice?${params.toString()}`;
  }

  function markTopicQuestionPassed(): { count: number; complete: boolean } {
    if (!isTopicFlow || !activeQuestion?.id) return { count: part1DoneCount, complete: false };
    const firstThree = new Set(card.questions.slice(0, requiredPassCount).map((q) => q.id));
    let done: string[] = [];
    try {
      done = JSON.parse(localStorage.getItem(progressKey) || "[]") as string[];
    } catch {
      done = [];
    }
    if (firstThree.has(activeQuestion.id) && !done.includes(activeQuestion.id)) {
      done = [...done, activeQuestion.id];
      localStorage.setItem(progressKey, JSON.stringify(done));
    }
    const count = done.filter((id) => firstThree.has(id)).length;
    setPassedQuestionIds(done);
    setPart1DoneCount(count);
    return { count, complete: count >= requiredPassCount };
  }

  function lightTopicMapNode() {
    const peak = Number(card.pk);
    const node = Number(card.n);
    if (Number.isNaN(peak) || Number.isNaN(node)) return;
    try {
      const stored = JSON.parse(localStorage.getItem(MAP_PROGRESS_KEY) || "{}") as Record<string, number>;
      const key = `${card.p}-${peak}`;
      const nextDone = node + 1;
      if ((stored[key] ?? 0) < nextDone) {
        localStorage.setItem(MAP_PROGRESS_KEY, JSON.stringify({ ...stored, [key]: nextDone }));
      }
    } catch {}
  }

  function finishPassedCard() {
    if (!isTopicFlow) {
      goMap(true);
      return;
    }
    const result = markTopicQuestionPassed();
    if (result.complete) {
      lightTopicMapNode();
      goMap(true);
      return;
    }
    const next = Math.min(qIndex + 1, card.questions.length - 1);
    showToast(`已完成 ${result.count}/${requiredPassCount}，继续练下一题`);
    setFbOpen(false);
    changeQuestion(next);
  }

  function handleSwipeEnd(clientX: number, clientY: number) {
    const start = dragStart.current ?? touchStart.current;
    dragStart.current = null;
    touchStart.current = null;
    if (!isTopicFlow || !start) return;
    const dx = clientX - start.x;
    const dy = clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    changeQuestion(qIndex + (dx < 0 ? 1 : -1));
  }

  function genPersonal() {
    const persona = (localStorage.getItem("speaker_persona") || "").trim();
    showToast(persona ? `✍️ 按你的人设生成中…「${persona.slice(0, 12)}…」` : "先去「我的」填写个性化人设");
  }

  const passed = !!fb && !fb.rejected && fb.band >= target - 0.5;
  const showScore = !!fb && !fb.rejected;
  const passCtaText = isTopicFlow && part1DoneCount < requiredPassCount - 1 ? "继续下一题" : "点亮此关 ✦";
  const navStepCount = isTopicFlow ? Math.max(1, Math.min(5, card.questions.length)) : 5;
  const navWindowCenterOffset = Math.floor(navStepCount / 2);
  const navWindowStart = isTopicFlow ? Math.min(Math.max(qIndex - navWindowCenterOffset, 0), Math.max(card.questions.length - navStepCount, 0)) : 0;
  const navStepIndex = isTopicFlow ? qIndex - navWindowStart : 1;
  const passedQuestionSet = new Set(passedQuestionIds);

  function goMap(done: boolean) {
    const base = `?p=${card.p || "1"}&pk=${card.pk || "0"}`;
    const qs = done
      ? `${base}&n=${card.n}&done=1&topic=${encodeURIComponent(card.crumb)}`
      : base;
    router.push(`/map${qs}`);
  }

  function mapHref(done: boolean): string {
    const base = `?p=${card.p || "1"}&pk=${card.pk || "0"}`;
    return done ? `/map${base}&n=${card.n}&done=1&topic=${encodeURIComponent(card.crumb)}` : `/map${base}`;
  }

  const settingsHref = `/profile?returnTo=${encodeURIComponent(questionHref(qIndex))}`;

  const goalText =
    mode === "mock" ? (
      <>
        隐藏范本，用自己的话说 · <b>意思大致完整</b>即可
      </>
    ) : (
      <>
        跟读到 <b>{passMark}</b> 即可通关 · 只看发音和流利度
      </>
    );

  return (
    <div className={styles.stage}>
      <div className={styles.phone}>
        <div className={styles.top}>
          <div className={styles.toprow}>
            <a
              className={styles.back}
              aria-label="返回地图"
              href={mapHref(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </a>
            <div className={styles.crumb}>
              <b>{card.part}</b>
            </div>
            <div className={styles.topActions}>
              {isTopicFlow ? (
                <button className={styles.settings} aria-label="题目列表" onClick={() => setPickerOpen(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 6h13" />
                    <path d="M8 12h13" />
                    <path d="M8 18h13" />
                    <path d="M3 6h.01" />
                    <path d="M3 12h.01" />
                    <path d="M3 18h.01" />
                  </svg>
                </button>
              ) : null}
              <div className={styles.pill}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#FF9466" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 21V5a1 1 0 0 1 1-1h11l-2 4 2 4H6" />
                </svg>
                <span>{target.toFixed(1)}</span>
              </div>
              <a
                className={styles.settings}
                aria-label="设置"
                href={settingsHref}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 0 1-4 0v-.06a1.7 1.7 0 0 0-1-.54 1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 0 1 0-4h.06a1.7 1.7 0 0 0 .54-1 1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 0 1 4 0v.06a1.7 1.7 0 0 0 1 .54 1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.2.36.4.68.6 1H20a2 2 0 0 1 0 4h-.06a1.7 1.7 0 0 0-.54 1Z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className={styles.scroll}>
        <div
          className={styles.main}
          onMouseDown={(e) => {
            dragStart.current = { x: e.clientX, y: e.clientY };
          }}
          onMouseUp={(e) => handleSwipeEnd(e.clientX, e.clientY)}
          onMouseLeave={() => {
            dragStart.current = null;
          }}
          onTouchStart={(e) => {
            touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => handleSwipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
        >
          <div
            className={styles.qcard}
          >
            <div className={styles.qtext}>{currentText}</div>
            {isTopicFlow ? (
              <div className={styles.qMeta}>
                Q{qIndex + 1} / {card.questions.length} · 已过 {part1DoneCount}/{requiredPassCount}
              </div>
            ) : null}
            <div className={styles.sub}>
              {(currentBullets.length ? currentBullets : [card.crumb]).map((b, i) => (
                <span key={i}>
                  {b}
                  {i < currentBullets.length - 1 ? <br /> : null}
                </span>
              ))}
            </div>
            <div className={`${styles.dots} ${styles.cardDots}`} aria-label="题目进度">
              {Array.from({ length: navStepCount }).map((_, index) => (
                (() => {
                  const questionIndex = navWindowStart + index;
                  const question = card.questions[questionIndex];
                  return (
                    <span
                      key={questionIndex}
                      className={index === navStepIndex ? styles.cur : questionIndex < qIndex && passedQuestionSet.has(question?.id || "") ? styles.done : ""}
                    />
                  );
                })()
              ))}
            </div>
          </div>
          {isTopicFlow ? (
            <div className={styles.cardNav}>
              <a
                href={questionHref(qIndex - 1)}
                aria-disabled={qIndex === 0}
                onClick={(e) => {
                  e.preventDefault();
                  if (qIndex > 0) changeQuestion(qIndex - 1);
                }}
              >
                上一题
              </a>
              <a
                href={questionHref(qIndex + 1)}
                aria-disabled={qIndex >= card.questions.length - 1}
                onClick={(e) => {
                  e.preventDefault();
                  if (qIndex < card.questions.length - 1) changeQuestion(qIndex + 1);
                }}
              >
                下一题
              </a>
            </div>
          ) : null}

          <div className={`${styles.reveal} ${revealOpen ? styles.open : ""}`}>
            <div
              className={styles.toggle}
              role="button"
              tabIndex={0}
              aria-label={revealOpen ? "Collapse sample answer" : "Expand sample answer"}
              aria-expanded={revealOpen}
              onClick={toggleReveal}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                toggleReveal();
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <div className={styles.panel}>
              <div className={styles.ans}>
                {currentAnswer ? highlightAnswer(currentAnswer, openWord) : "这个题目还没有范文，先用自己的话试着回答。"}
              </div>
              <div className={styles.anstools}>
                <button onClick={() => showToast("🔊 示范朗读中…")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4z" />
                    <path d="M16 9a4 4 0 0 1 0 6" />
                  </svg>
                  示范朗读
                </button>
                <button onClick={genPersonal}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19l7-7-3-3-7 7v3z" />
                    <path d="M16 9l3-3-2-2-3 3" />
                  </svg>
                  个性化
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.dock} ${recording ? styles.isRecording : ""} ${scoring ? styles.isScoring : ""}`}>
          <div className={styles.seg}>
            <button className={mode === "follow" ? styles.active : ""} onClick={() => changeMode("follow")}>
              跟读练习
            </button>
            <button className={mode === "mock" ? styles.active : ""} onClick={() => changeMode("mock")}>
              模拟作答
            </button>
          </div>
          <div className={styles.goal}>{goalText}</div>
          <div className={styles.recwrap}>
            <button
              className={`${styles.rec} ${recording ? styles.recording : ""}`}
              onClick={toggleRecording}
              disabled={scoring}
              aria-label={recording ? "Stop recording" : "Start recording"}
            >
              <span className={styles.ring} />
              {recording ? (
                <span className={styles.wave} aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <span
                      key={index}
                      style={{ transform: `scaleY(${0.32 + Math.min(1, voiceLevel * (1.15 + index * 0.18))})` }}
                    />
                  ))}
                </span>
              ) : null}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <path d="M12 17v4" />
              </svg>
            </button>
          </div>
          <div className={styles.rectip}>
            {scoring ? "正在听你的发音…" : recording ? "录音中… 松手提交" : "长按录音 · 松手提交"}
          </div>
        </div>

        </div>

        {toast ? <div className={`${styles.toast} ${styles.show}`}>{toast}</div> : null}

        {/* feedback sheet */}
        <div className={`${styles.fbmask} ${fbOpen ? styles.show : ""}`} onClick={() => setFbOpen(false)} />
        <div className={`${styles.fb} ${fbOpen ? styles.show : ""}`}>
          <div className={styles.grab} />
          <div className={styles.band}>
            <div className={styles.score}>{showScore ? fb!.band.toFixed(1) : "—"}</div>
            {mode === "mock" ? (
              <div className={styles.dims}>
                <div className={styles.dim}>
                  <div className={styles.dl}>Fluency & Coherence</div>
                  <div className={styles.dv}>{showScore ? fb!.fluency.toFixed(1) : "—"}</div>
                </div>
                <div className={styles.dim}>
                  <div className={styles.dl}>Lexical</div>
                  <div className={styles.dv}>{showScore && fb!.lexicalResource != null ? fb!.lexicalResource.toFixed(1) : "—"}</div>
                </div>
                <div className={styles.dim}>
                  <div className={styles.dl}>Grammar</div>
                  <div className={styles.dv}>{showScore && fb!.grammar != null ? fb!.grammar.toFixed(1) : "—"}</div>
                </div>
                <div className={styles.dim}>
                  <div className={styles.dl}>Pronunciation</div>
                  <div className={styles.dv}>{showScore ? fb!.pronunciation.toFixed(1) : "—"}</div>
                </div>
              </div>
            ) : (
              <div className={styles.dims}>
                <div className={styles.dim}>
                  <div className={styles.dl}>Pronunciation</div>
                  <div className={styles.dv}>{showScore ? fb!.pronunciation.toFixed(1) : "—"}</div>
                </div>
                <div className={styles.dim}>
                  <div className={styles.dl}>Fluency</div>
                  <div className={styles.dv}>{showScore ? fb!.fluency.toFixed(1) : "—"}</div>
                </div>
              </div>
            )}
          </div>
          <div className={styles.advice}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4 12c-.7.7-1 1.3-1 2H9c0-.7-.3-1.3-1-2A7 7 0 0 1 12 2z" />
            </svg>
            <span>{fb?.advice}</span>
          </div>
          {fb?.transcript ? <div className={styles.transcript}>转写：{fb.transcript}</div> : null}
          {fb?.evidence?.length ? (
            <div className={styles.evidence}>
              {fb.evidence.map((item) => (
                <div key={item}>• {item}</div>
              ))}
            </div>
          ) : null}
          <div className={styles.fbcta}>
            <button
              className={styles.retry}
              style={passed ? undefined : { flex: 1 }}
              onClick={() => setFbOpen(false)}
            >
              再练一次
            </button>
            {passed ? (
              <button className={styles.pass} onClick={finishPassedCard}>
                {passCtaText}
              </button>
            ) : null}
          </div>
        </div>

        {isTopicFlow ? (
          <>
            <div className={`${styles.mask} ${pickerOpen ? styles.show : ""}`} onClick={() => setPickerOpen(false)} />
            <div className={`${styles.sheet} ${pickerOpen ? styles.show : ""}`}>
              <div className={styles.grab} />
              <div className={styles.pickerTitle}>{card.crumb}</div>
              <div className={styles.questionList}>
                {card.questions.map((question, index) => (
                  <button
                    key={question.id}
                    className={index === qIndex ? styles.activeQuestion : ""}
                    onClick={() => changeQuestion(index)}
                  >
                    <b>Q{index + 1}</b>
                    <span>{question.content}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {/* word sheet */}
        <div className={`${styles.mask} ${sheetOpen ? styles.show : ""}`} onClick={() => setSheetOpen(false)} />
        <div className={`${styles.sheet} ${sheetOpen ? styles.show : ""}`}>
          <div className={styles.grab} />
          <div className={styles.word}>{word?.word}</div>
          <div className={styles.ipa}>{word?.ipa}</div>
          <button className={styles.play} onClick={() => showToast("🔊 播放发音")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 5v14l11-7z" />
            </svg>
            播放发音
          </button>
          <div className={styles.def}>{word?.def}</div>
          <div className={styles.colloc}>常见搭配：{word?.colloc}</div>
          <button className={styles.add} onClick={() => showToast("⭐ 已加入生词本")}>
            ＋ 加入生词本
          </button>
        </div>
      </div>
    </div>
  );
}
