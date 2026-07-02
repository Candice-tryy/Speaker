import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { getBank, scoreAudio, type Question, type ScoreResult, type Topic } from "../../lib/api";
import { ensureRecordPermission, startRecording, type RecordingController } from "../../lib/recorder";
import { getSettings, markNodeDone, needForPart, nodeKey } from "../../lib/store";
import "./index.scss";

type Phase = "loading" | "ready" | "recording" | "scoring" | "done" | "error";
type Mode = "follow" | "mock";

function decode(value = "") {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
  const [passed, setPassed] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [rec, setRec] = useState<RecordingController | null>(null);
  const [answerOpen, setAnswerOpen] = useState(true);
  const [showList, setShowList] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchX = useRef<number | null>(null);

  const target = getSettings().targetBand;

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
        setPhase(card ? "ready" : "error");
        if (!card) setErrMsg("题库为空");
      })
      .catch((error) => {
        setErrMsg(String(error?.errMsg || error));
        setPhase("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }

  const questions: Question[] = topic?.questions || [];
  const need = Math.min(needForPart(partName), questions.length || 1);
  const passedCount = Object.values(passed).filter(Boolean).length;
  const current = questions[qIdx];
  const refText = useMemo(() => current?.answer || current?.content || "", [current]);
  const passedThis = !!result && !result.rejected && result.band >= target - 0.5;

  async function onStart() {
    const ok = await ensureRecordPermission();
    if (!ok) {
      showToast("需要麦克风权限才能跟读");
      return;
    }
    try {
      const controller = await startRecording();
      setRec(controller);
      setPhase("recording");
    } catch {
      setErrMsg("麦克风启动失败，请在设置里允许录音");
      setPhase("error");
    }
  }

  async function onStop() {
    if (!rec) return;
    setPhase("scoring");
    try {
      const audioBase64 = await rec.stop();
      const r = await scoreAudio({ refText, audioBase64, recited: true });
      setResult(r);
      setPhase("done");
      if (!r.rejected) {
        const nextPassed = { ...passed, [qIdx]: true };
        setPassed(nextPassed);
        const count = Object.values(nextPassed).filter(Boolean).length;
        if (count >= need) markNodeDone(nodeKey(partIdx, peakIdx, nodeIdx));
      }
    } catch (error) {
      setErrMsg(String((error as any)?.errMsg || error));
      setPhase("error");
    } finally {
      setRec(null);
    }
  }

  function goTo(index: number) {
    const bounded = Math.max(0, Math.min(index, questions.length - 1));
    setQIdx(bounded);
    setResult(null);
    setPhase("ready");
    setShowList(false);
    setAnswerOpen(true);
  }

  function nextAfterPass() {
    if (qIdx < questions.length - 1) {
      goTo(qIdx + 1);
      return;
    }
    Taro.navigateBack();
  }

  function backMap() {
    Taro.navigateBack();
  }

  function openProfile() {
    Taro.navigateTo({ url: "/pages/profile/index?returnTo=practice" });
  }

  if (phase === "loading") {
    return <View className="practice-loading">加载题库中...</View>;
  }

  if (phase === "error") {
    return (
      <View className="practice-error">
        <Text>出错了：{errMsg}</Text>
        <View className="error-btn" onClick={() => Taro.navigateBack()}>返回地图</View>
      </View>
    );
  }

  return (
    <View className="practice-shell">
      <View className="practice-phone">
        <View className="practice-top">
          <View className="icon-btn" onClick={backMap}>‹</View>
          <View className="crumb">
            <Text>{partName} · {topic?.title || topic?.tag || "Practice"}</Text>
          </View>
          <View className="top-actions">
            <View className="icon-btn" onClick={() => setShowList(true)}>☰</View>
            <View className="target-pill">🎯 {target.toFixed(1)}</View>
            <View className="icon-btn" onClick={openProfile}>⚙</View>
          </View>
        </View>

        <View
          className="practice-main"
          onTouchStart={(event) => {
            touchX.current = (event as any).touches?.[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchX.current === null) return;
            const dx = ((event as any).changedTouches?.[0]?.clientX ?? touchX.current) - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 46) goTo(qIdx + (dx < 0 ? 1 : -1));
          }}
        >
          <View className="question-card">
            <Text className="kind">Current card · Part {current?.part || ""}</Text>
            <Text className="question-text">{current?.content || "暂无题目"}</Text>
            <Text className="question-meta">Q{qIdx + 1}/{questions.length} · 已过 {passedCount}/{need}</Text>
          </View>

          <View className={`answer-box ${answerOpen ? "open" : ""}`}>
            <View className="answer-toggle" onClick={() => setAnswerOpen((v) => !v)}>⌃</View>
            {answerOpen && (
              <View className="answer-panel">
                <Text>{refText || "这个题目还没有范文，先用自己的话试着回答。"}</Text>
                <View className="answer-tools">
                  <View onClick={() => showToast("示范朗读稍后接入")}>示范朗读</View>
                  <View onClick={() => showToast("个性化生成稍后接入")}>个性化</View>
                </View>
              </View>
            )}
          </View>
        </View>

        <View className="practice-dock">
          <View className="mode-seg">
            <Text className={mode === "follow" ? "active" : ""} onClick={() => setMode("follow")}>跟读练习</Text>
            <Text className={mode === "mock" ? "active" : ""} onClick={() => setMode("mock")}>模拟作答</Text>
          </View>
          <Text className="goal-line">
            {mode === "follow" ? `跟读到 ${(target - 0.5).toFixed(1)} 即可通关` : "隐藏范文，用自己的话完整回答"}
          </Text>

          {phase === "ready" && (
            <View className="rec-button" onClick={onStart}>
              <Text>🎙</Text>
            </View>
          )}
          {phase === "recording" && (
            <View className="rec-button recording" onClick={onStop}>
              <View className="ring" />
              <Text>{elapsed}s</Text>
            </View>
          )}
          {phase === "scoring" && <View className="scoring">正在听你的发音...</View>}
          <Text className="rec-tip">{phase === "recording" ? "点击结束并提交" : "点击录音 · 再点提交"}</Text>
        </View>

        {phase === "done" && result && (
          <View className="sheet-mask" onClick={() => setPhase("ready")}>
            <View className="feedback-sheet" onClick={(event) => event.stopPropagation()}>
              <View className="grab" />
              {result.rejected ? (
                <Text className="reject">没听清，请再读一遍</Text>
              ) : (
                <>
                  <View className="score-row">
                    <Text className="score">{result.band.toFixed(1)}</Text>
                    <View className="dims">
                      <View><Text>Pronunciation</Text><Text>{result.pronunciation.toFixed(1)}</Text></View>
                      <View><Text>Fluency</Text><Text>{result.fluency.toFixed(1)}</Text></View>
                    </View>
                  </View>
                  <Text className="advice">{result.advice}</Text>
                </>
              )}
              <View className="feedback-actions">
                <View className="retry-btn" onClick={() => setPhase("ready")}>再练一次</View>
                {passedThis && <View className="pass-btn" onClick={nextAfterPass}>点亮这一关</View>}
              </View>
            </View>
          </View>
        )}

        {showList && (
          <View className="sheet-mask" onClick={() => setShowList(false)}>
            <View className="question-sheet" onClick={(event) => event.stopPropagation()}>
              <View className="grab" />
              <Text className="sheet-title">{topic?.title || "题目列表"}</Text>
              <ScrollView scrollY className="question-list">
                {questions.map((q, index) => (
                  <View
                    key={q.id}
                    className={`question-row ${index === qIdx ? "active" : ""}`}
                    onClick={() => goTo(index)}
                  >
                    <Text>Q{index + 1}</Text>
                    <Text>{q.content}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {toast ? <View className="practice-toast">{toast}</View> : null}
      </View>
    </View>
  );
}
