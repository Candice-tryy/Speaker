import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Image, View, Text, ScrollView } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { getBank, scoreAudio, scoreSpeaking, toPracticeQuestions, type PracticeQuestion, type ScoreResult, type Topic } from "../../lib/api";
import { ICONS } from "../../lib/icons.gen";
import { ensureRecordPermission, startRecording, type RecordingController } from "../../lib/recorder";
import { getSettings, getTopicPassed, lightMapNode, needForPart, setTopicPassed } from "../../lib/store";
import { capsuleCenteredTop, chromeInsets } from "../../lib/ui";
import "./index.scss";

type Phase = "loading" | "ready" | "recording" | "scoring" | "error";
type Mode = "follow" | "mock";

interface WordInfo {
  word: string;
  ipa: string;
  def: string;
  colloc: string;
}

// Lightweight placeholder highlight word list (same as the web version).
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
    if (mt.start > cursor) nodes.push(<Text key={`t-${i}`}>{answer.slice(cursor, mt.start)}</Text>);
    nodes.push(
      <Text
        key={`w-${i}`}
        className="w"
        onClick={() => onWord({ word: mt.text, ipa: "", def: mt.def, colloc: mt.colloc })}
      >
        {mt.text}
      </Text>
    );
    cursor = mt.end;
  }
  if (cursor < answer.length) nodes.push(<Text key="t-end">{answer.slice(cursor)}</Text>);
  return nodes;
}

function decode(value = "") {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Compact crumb labels so the header row fits beside the capsule button.
// All labels render at the same font size, matching the "PART1" reference.
function shortPartLabel(name: string): string {
  return name === "Part 1" ? "PART1" : name.replace(/^Part\s*/i, "P");
}

export default function Practice() {
  const router = useRouter();
  const params = router.params || {};
  const partName = decode(params.part || "Part 2&3");
  const partIdx = Number(params.pi ?? 1);
  const peakIdx = Number(params.peak ?? 0);
  const nodeIdx = Number(params.node ?? 0);
  const topicId = params.topicId || "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [mode, setMode] = useState<Mode>("follow");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [passedQuestionIds, setPassedQuestionIds] = useState<string[]>([]);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [fbOpen, setFbOpen] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [answerOpen, setAnswerOpen] = useState(true);
  const [showList, setShowList] = useState(false);
  const [word, setWord] = useState<WordInfo | null>(null);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const holdingRef = useRef(false);
  const recRef = useRef<RecordingController | null>(null);
  const recStartingRef = useRef<Promise<RecordingController> | null>(null);
  const recitedRef = useRef(false);
  const recStartAtRef = useRef(0);

  const target = getSettings().targetBand;
  const passMark = (target - 0.5).toFixed(1);
  const insets = useMemo(() => chromeInsets(), []);

  useEffect(() => {
    getBank()
      .then((bank) => {
        const part = bank.parts.find((p) => p.name === partName) || bank.parts[0];
        let card: Topic | null = null;
        for (const peak of part?.peaks || []) {
          const found = peak.cards.find((c) => String(c.id) === String(topicId));
          if (found) card = found;
        }
        if (!card) card = part?.peaks[peakIdx]?.cards[nodeIdx] || part?.peaks[0]?.cards[0] || null;
        setTopic(card);
        if (card?.id) setPassedQuestionIds(getTopicPassed(partName, card.id));
        setPhase(card ? "ready" : "error");
        if (!card) setErrMsg("题库为空");
      })
      .catch((error) => {
        setErrMsg(String(error?.errMsg || error));
        setPhase("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(message: string) {
    setToast(message);
    setToastVisible(false);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (toastClearTimer.current) clearTimeout(toastClearTimer.current);
    setTimeout(() => setToastVisible(true), 30);
    toastTimer.current = setTimeout(() => setToastVisible(false), 1450);
    toastClearTimer.current = setTimeout(() => setToast(""), 1800);
  }

  const questions: PracticeQuestion[] = useMemo(
    () => (topic ? toPracticeQuestions(topic, partName) : []),
    [topic, partName]
  );
  const need = Math.min(needForPart(partName), questions.length || 1);
  const requiredQuestionIds = useMemo(() => new Set(questions.slice(0, need).map((q) => q.id)), [questions, need]);
  const passedCount = passedQuestionIds.filter((id) => requiredQuestionIds.has(id)).length;
  const current = questions[qIdx];
  const sampleAnswer = current?.answer || "";
  const refText = useMemo(() => current?.answer || current?.content || "", [current]);
  const passed = !!result && !result.rejected && result.band >= target - 0.5;
  const showScore = !!result && !result.rejected;
  const scoring = phase === "scoring";
  const recording = phase === "recording";
  const navStepCount = Math.max(1, Math.min(5, questions.length || 5));
  const navWindowCenterOffset = Math.floor(navStepCount / 2);
  const navWindowStart = Math.min(Math.max(qIdx - navWindowCenterOffset, 0), Math.max(questions.length - navStepCount, 0));
  const navStepIndex = qIdx - navWindowStart;
  const passedQuestionSet = useMemo(() => new Set(passedQuestionIds), [passedQuestionIds]);

  // Long-press recording, ported from the web version: press starts the take,
  // release anywhere ends it and submits.
  async function onRecStart() {
    if (holdingRef.current || scoring) return;
    holdingRef.current = true;
    recStartAtRef.current = Date.now();
    setVoiceLevel(0);
    setPhase("recording");
    const ok = await ensureRecordPermission();
    if (!ok) {
      holdingRef.current = false;
      setVoiceLevel(0);
      setPhase("ready");
      showToast("需要麦克风权限才能跟读");
      return;
    }
    if (!holdingRef.current) return; // released during the permission prompt
    try {
      const pending = startRecording(setVoiceLevel);
      recStartingRef.current = pending;
      const controller = await pending;
      if (recStartingRef.current === pending) recStartingRef.current = null;
      if (!holdingRef.current) return;
      recRef.current = controller;
    } catch {
      // No mic: the take still submits (server falls back to mock).
      recStartingRef.current = null;
    }
  }

  async function onRecEnd() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    setVoiceLevel(0);
    let controller = recRef.current;
    recRef.current = null;
    setPhase("scoring");
    let audio = "";
    if (!controller && recStartingRef.current) {
      try {
        controller = await recStartingRef.current;
      } catch {
        controller = null;
      } finally {
        recStartingRef.current = null;
      }
      if (recRef.current === controller) recRef.current = null;
    }
    if (controller) {
      try {
        audio = await controller.stop();
      } catch {
        audio = "";
      }
    }
    try {
      const durationMs = recStartAtRef.current ? Date.now() - recStartAtRef.current : undefined;
      const score =
        mode === "mock"
          ? await scoreSpeaking({ part: partName, question: current?.content || current?.qtext || "", audioBase64: audio, durationMs })
          : await scoreAudio({ refText, audioBase64: audio, mode, recited: recitedRef.current });
      setResult(score);
      setFbOpen(true);
      recitedRef.current = true;
    } catch {
      showToast("评分服务暂时不可用，请重试");
    } finally {
      setPhase("ready");
    }
  }

  function onRecTap() {
    if (recording) {
      void onRecEnd();
      return;
    }
    void onRecStart();
  }

  function changeMode(next: Mode) {
    setMode(next);
    if (next === "mock") setAnswerOpen(false);
  }

  function goTo(index: number) {
    const bounded = Math.max(0, Math.min(index, questions.length - 1));
    setQIdx(bounded);
    setResult(null);
    setFbOpen(false);
    setShowList(false);
    setAnswerOpen(true);
    recitedRef.current = false;
  }

  function handleSwipeEnd(x: number, y: number) {
    if (!touchStart.current) return;
    const dx = x - touchStart.current.x;
    const dy = y - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    goTo(qIdx + (dx < 0 ? 1 : -1));
  }

  function finishPassedQuestion() {
    if (!topic || !current?.id) {
      Taro.navigateBack();
      return;
    }
    const nextPassed = passedQuestionIds.includes(current.id) ? passedQuestionIds : [...passedQuestionIds, current.id];
    setPassedQuestionIds(nextPassed);
    setTopicPassed(partName, topic.id, nextPassed);
    const count = nextPassed.filter((id) => requiredQuestionIds.has(id)).length;
    if (count >= need) lightMapNode(partIdx, peakIdx, nodeIdx);
    showToast(`已完成 ${count}/${need}，继续练下一题`);
    setFbOpen(false);
    if (qIdx < questions.length - 1) goTo(qIdx + 1);
    else Taro.navigateBack();
  }

  function genPersonal() {
    const persona = (getSettings().name || "").trim();
    showToast(persona ? `✍️ 按你的人设生成中…「${persona.slice(0, 12)}…」` : "先去「我的」填写个性化人设");
  }

  // Share the capsule's row: center on it vertically (the 34px back button +
  // border is taller than the capsule, so top-alignment reads as "too low"),
  // and reserve the capsule's width on the right so the list/target/gear
  // cluster never slides underneath it.
  const topStyle = `padding-top:${capsuleCenteredTop(36)}px;padding-right:${Math.max(20, insets.right + 8)}px`;

  if (phase === "loading") {
    return <View className="practice-phone center"><Text className="state-text">加载题库中...</Text></View>;
  }

  if (phase === "error") {
    return (
      <View className="practice-phone center">
        <Text className="state-text error">出错了：{errMsg}</Text>
        <View className="error-btn" onClick={() => Taro.navigateBack()}>返回地图</View>
      </View>
    );
  }

  return (
    <View className="practice-phone">
        <View className="top" style={topStyle}>
          <View className="toprow">
            <View className="back" onClick={() => Taro.navigateBack()}><Image className="icon" src={ICONS.back} /></View>
            <View className="crumb">
              <Text className="crumb-b">{shortPartLabel(partName)}</Text>
            </View>
            <View className="top-actions">
              <View className="settings" onClick={() => setShowList(true)}><Image className="icon" src={ICONS.list} /></View>
              <View className="pill"><Image className="icon" src={ICONS.flag} /><Text>{target.toFixed(1)}</Text></View>
              <View className="settings" onClick={() => Taro.navigateTo({ url: "/pages/profile/index?returnTo=practice" })}>
                <Image className="icon" src={ICONS.gearBlue} />
              </View>
            </View>
          </View>
        </View>

        <ScrollView scrollY className="scroll">
          <View
            className="main"
            onTouchStart={(event) => {
              const touch = (event as any).touches?.[0];
              touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
            }}
            onTouchEnd={(event) => {
              const touch = (event as any).changedTouches?.[0];
              if (touch) handleSwipeEnd(touch.clientX, touch.clientY);
            }}
          >
            <View
              className="qcard"
            >
              <Text className="qtext">{current?.qtext || current?.content || "暂无题目"}</Text>
              <Text className="q-meta">Q{qIdx + 1} / {questions.length} · 已过 {passedCount}/{need}</Text>
              <View className="sub">
                {(current?.bullets?.length ? current.bullets : [topic?.title || ""]).map((b, i) => (
                  <Text key={i}>{b}</Text>
                ))}
              </View>
              <View className="dots card-dots">
                {Array.from({ length: navStepCount }).map((_, index) => (
                  (() => {
                    const questionIndex = navWindowStart + index;
                    const question = questions[questionIndex];
                    return (
                      <View
                        key={questionIndex}
                        className={`dot ${index === navStepIndex ? "cur" : questionIndex < qIdx && passedQuestionSet.has(question?.id || "") ? "done" : ""}`}
                      />
                    );
                  })()
                ))}
              </View>
            </View>

            <View className={`reveal ${answerOpen ? "open" : ""}`}>
              <View
                className="toggle"
                onClick={() => setAnswerOpen((open) => !open)}
              >
                <Image className="icon" src={ICONS.chevronDown} />
              </View>
              <View className="panel">
                <ScrollView scrollY className="ans">
                  {sampleAnswer ? highlightAnswer(sampleAnswer, setWord) : <Text>这个题目还没有范文，先用自己的话试着回答。</Text>}
                </ScrollView>
                <View className="anstools">
                  <View onClick={() => showToast("🔊 示范朗读中…")}><Image className="icon" src={ICONS.speaker} /><Text>示范朗读</Text></View>
                  <View onClick={genPersonal}><Image className="icon" src={ICONS.pencil} /><Text>个性化</Text></View>
                </View>
              </View>
            </View>
          </View>

          <View className={`dock ${recording ? "is-recording" : ""} ${scoring ? "is-scoring" : ""}`}>
            <View className="seg">
              <Text className={mode === "follow" ? "active" : ""} onClick={() => changeMode("follow")}>跟读练习</Text>
              <Text className={mode === "mock" ? "active" : ""} onClick={() => changeMode("mock")}>模拟作答</Text>
            </View>
            <View className="goal">
              {mode === "mock" ? (
                <Text>隐藏范本，用自己的话说 · <Text className="goal-b">意思大致完整</Text>即可</Text>
              ) : (
                <Text>跟读到 <Text className="goal-b">{passMark}</Text> 即可通关 · 只看发音和流利度</Text>
              )}
            </View>
            <View className="recwrap">
              <View
                className={`rec ${recording ? "recording" : ""}`}
                onClick={onRecTap}
              >
                <View className="ring" />
                {recording ? (
                  <View className="wave">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <View
                        key={index}
                        className="wave-bar"
                        style={{ transform: `scaleY(${0.32 + Math.min(1, voiceLevel * (1.15 + index * 0.18))})` }}
                      />
                    ))}
                  </View>
                ) : null}
                <Image className="icon" src={ICONS.mic} />
              </View>
            </View>
            <Text className="rectip">
              {scoring ? "正在听你的发音..." : recording ? "录音中... 再点一下提交" : "点一下开始录音 · 再点一下提交"}
            </Text>
          </View>
        </ScrollView>

        {toast ? <View className={`toast ${toastVisible ? "show" : ""}`}>{toast}</View> : null}

        {/* feedback sheet */}
        <View className={`fbmask ${fbOpen ? "show" : ""}`} onClick={() => setFbOpen(false)} />
        <View className={`fb ${fbOpen ? "show" : ""}`}>
          <View className="grab" />
          <View className="band">
            <Text className="score">{showScore ? result!.band.toFixed(1) : "—"}</Text>
            {mode === "mock" ? (
              <View className="dims">
                <View className="dim">
                  <Text className="dl">Fluency & Coherence</Text>
                  <Text className="dv">{showScore ? result!.fluency.toFixed(1) : "—"}</Text>
                </View>
                <View className="dim">
                  <Text className="dl">Lexical</Text>
                  <Text className="dv">{showScore && result!.lexicalResource != null ? result!.lexicalResource.toFixed(1) : "—"}</Text>
                </View>
                <View className="dim">
                  <Text className="dl">Grammar</Text>
                  <Text className="dv">{showScore && result!.grammar != null ? result!.grammar.toFixed(1) : "—"}</Text>
                </View>
                <View className="dim">
                  <Text className="dl">Pronunciation</Text>
                  <Text className="dv">{showScore ? result!.pronunciation.toFixed(1) : "—"}</Text>
                </View>
              </View>
            ) : (
              <View className="dims">
                <View className="dim">
                  <Text className="dl">Pronunciation</Text>
                  <Text className="dv">{showScore ? result!.pronunciation.toFixed(1) : "—"}</Text>
                </View>
                <View className="dim">
                  <Text className="dl">Fluency</Text>
                  <Text className="dv">{showScore ? result!.fluency.toFixed(1) : "—"}</Text>
                </View>
              </View>
            )}
          </View>
          <View className="advice">
            <Image className="icon" src={ICONS.bulb} />
            <Text>{result?.advice}</Text>
          </View>
          {result?.transcript ? (
            <View className="transcript">
              <Text>转写：{result.transcript}</Text>
            </View>
          ) : null}
          {result?.evidence?.length ? (
            <View className="evidence">
              {result.evidence.map((item) => (
                <Text key={item}>• {item}</Text>
              ))}
            </View>
          ) : null}
          <View className="fbcta">
            <View className="retry" style={passed ? "" : "flex:1"} onClick={() => setFbOpen(false)}>再练一次</View>
            {passed ? <View className="pass" onClick={finishPassedQuestion}>点亮这一关 ✦</View> : null}
          </View>
        </View>

        {/* question picker sheet */}
        <View className={`mask ${showList ? "show" : ""}`} onClick={() => setShowList(false)} />
        <View className={`sheet ${showList ? "show" : ""}`}>
          <View className="grab" />
          <Text className="picker-title">{topic?.title || "题目列表"}</Text>
          <ScrollView scrollY className="question-list">
            {questions.map((q, index) => (
              <View key={q.id} className={`question-row ${index === qIdx ? "active" : ""}`} onClick={() => goTo(index)}>
                <Text className="qno">Q{index + 1}</Text>
                <Text className="qcontent">{q.content}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* word sheet */}
        <View className={`mask ${word ? "show" : ""}`} onClick={() => setWord(null)} />
        <View className={`sheet ${word ? "show" : ""}`}>
          <View className="grab" />
          <Text className="word">{word?.word}</Text>
          {word?.ipa ? <Text className="ipa">{word.ipa}</Text> : null}
          <View className="play" onClick={() => showToast("🔊 播放发音")}><Image className="icon" src={ICONS.play} /><Text>播放发音</Text></View>
          <Text className="def">{word?.def}</Text>
          <Text className="colloc">常见搭配：{word?.colloc}</Text>
          <View className="add" onClick={() => showToast("⭐ 已加入生词本")}>＋ 加入生词本</View>
        </View>
    </View>
  );
}
