import { useEffect, useMemo, useState } from "react";
import { View, Text, Button, ScrollView } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { getBank, scoreAudio, type Topic, type Question, type ScoreResult } from "../../lib/api";
import { startRecording, ensureRecordPermission, type RecordingController } from "../../lib/recorder";
import { markNodeDone, nodeKey, needForPart } from "../../lib/store";
import "./index.scss";

type Phase = "loading" | "ready" | "recording" | "scoring" | "done" | "error";

export default function Practice() {
  const router = useRouter();
  const params = router.params || {};
  const partName = decodeURIComponent(params.part || "Part 2&3");
  const partIdx = Number(params.pi ?? 1);
  const peakIdx = Number(params.peak ?? 0);
  const nodeIdx = Number(params.node ?? 0);
  const topicId = params.topicId || "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [passed, setPassed] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [rec, setRec] = useState<RecordingController | null>(null);
  const [showList, setShowList] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Tick a recording timer so the user sees it's live and how long they've read.
  useEffect(() => {
    if (phase !== "recording") return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    getBank()
      .then((bank) => {
        const part = bank.parts.find((p) => p.name === partName) || bank.parts[0];
        let card: Topic | null = null;
        for (const peak of part?.peaks || []) {
          const found = peak.cards.find((c) => String(c.id) === String(topicId));
          if (found) {
            card = found;
            break;
          }
        }
        if (!card) card = part?.peaks[peakIdx]?.cards[nodeIdx] || part?.peaks[0]?.cards[0] || null;
        setTopic(card);
        setPhase(card ? "ready" : "error");
        if (!card) setErrMsg("题库为空");
      })
      .catch((e) => {
        setErrMsg(String(e?.errMsg || e));
        setPhase("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const questions: Question[] = topic?.questions || [];
  const need = Math.min(needForPart(partName), questions.length || 1);
  const passedCount = Object.values(passed).filter(Boolean).length;
  const current = questions[qIdx];

  // For 跟读, read the Band7 model answer aloud (the reference 讯飞 scores
  // against); fall back to the question text when a topic has no sample.
  const refText = useMemo(
    () => current?.answer || current?.content || "",
    [current]
  );

  async function onStart() {
    const ok = await ensureRecordPermission();
    if (!ok) {
      Taro.showToast({ title: "需要麦克风权限才能跟读", icon: "none" });
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
        if (count >= need) {
          markNodeDone(nodeKey(partIdx, peakIdx, nodeIdx));
          Taro.showToast({ title: "点亮这一关 ✨", icon: "none" });
        }
      }
    } catch (e) {
      setErrMsg(String((e as any)?.errMsg || e));
      setPhase("error");
    } finally {
      setRec(null);
    }
  }

  function goTo(i: number) {
    setQIdx(i);
    setResult(null);
    setPhase("ready");
    setShowList(false);
  }

  function next() {
    if (qIdx < questions.length - 1) goTo(qIdx + 1);
    else Taro.navigateBack();
  }

  if (phase === "loading") {
    return <View style="padding:48px;text-align:center;color:#1E7A66">加载题库中…</View>;
  }
  if (phase === "error") {
    return (
      <View style="padding:32px;color:#C9537F">
        <Text>出错了：{errMsg}</Text>
      </View>
    );
  }

  return (
    <View style="min-height:100vh;background:#D9F0FF;padding:16px 20px 32px;box-sizing:border-box">
      <View style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <Text style="font-size:14px;color:#1E7A66;font-weight:600">
          第 {qIdx + 1}/{questions.length} 题 · 已过 {passedCount}/{need}
        </Text>
        <Text
          style="font-size:13px;color:#2E9C97;background:#fff;padding:6px 12px;border-radius:999px"
          onClick={() => setShowList(true)}
        >
          题目列表
        </Text>
      </View>

      <View style="background:#fff;border-radius:20px;padding:20px;box-shadow:0 8px 24px rgba(46,156,151,0.12)">
        <Text style="font-size:13px;color:#2E9C97">
          {topic?.tag || partName} · Part {current?.part}
        </Text>
        <View style="height:8px" />
        <Text style="font-size:17px;line-height:1.5;color:#1f2937">{current?.content}</Text>
      </View>

      <View style="height:16px" />

      <View style="background:#fff;border-radius:20px;padding:20px">
        <Text style="font-size:13px;color:#2E9C97">跟读这段</Text>
        <View style="height:8px" />
        <Text style="font-size:15px;line-height:1.6;color:#374151">{refText}</Text>
      </View>

      <View style="height:24px" />

      {phase === "ready" && (
        <Button style="background:#3FC196;color:#fff;border-radius:999px;font-size:16px" onClick={onStart}>
          🎤 开始跟读
        </Button>
      )}
      {phase === "recording" && (
        <View>
          <View className="rec-live">
            <View className="rec-dot" />
            <Text>录音中 {elapsed}s</Text>
          </View>
          <Button style="background:#EC7CA8;color:#fff;border-radius:999px;font-size:16px" onClick={onStop}>
            ⏹ 点此结束
          </Button>
        </View>
      )}
      {phase === "scoring" && (
        <View style="text-align:center;color:#1E7A66;font-size:15px">评分中…</View>
      )}

      {phase === "done" && result && (
        <View style="background:#fff;border-radius:20px;padding:24px;text-align:center">
          {result.rejected ? (
            <Text style="font-size:16px;color:#C9537F">没听清，请再读一遍～</Text>
          ) : (
            <View>
              <Text style="font-size:40px;font-weight:700;color:#1E7A66">{result.band.toFixed(1)}</Text>
              <View style="height:6px" />
              <Text style="font-size:13px;color:#6b7280">
                发音 {result.pronunciation.toFixed(1)} · 流利度 {result.fluency.toFixed(1)}
                {result.source === "mock" ? " · (mock)" : ""}
              </Text>
              <View style="height:14px" />
              <Text style="font-size:15px;line-height:1.6;color:#374151">{result.advice}</Text>
            </View>
          )}
          <View style="height:20px;display:flex;gap:10px;justify-content:center">
            <Button
              style="background:#EAF3F0;color:#1E7A66;border-radius:999px;font-size:14px"
              onClick={() => goTo(qIdx)}
            >
              再读一次
            </Button>
            <Button
              style="background:#3FC196;color:#fff;border-radius:999px;font-size:14px"
              onClick={next}
            >
              {qIdx < questions.length - 1 ? "下一题" : "完成"}
            </Button>
          </View>
        </View>
      )}

      {showList && (
        <View
          style="position:fixed;left:0;right:0;top:0;bottom:0;background:rgba(0,0,0,0.35);display:flex;align-items:flex-end"
          onClick={() => setShowList(false)}
        >
          <View
            style="background:#fff;width:100%;border-radius:20px 20px 0 0;max-height:64vh;padding:20px"
            onClick={(e) => e.stopPropagation()}
          >
            <Text style="font-size:16px;font-weight:700;color:#1E7A66">题目列表</Text>
            <View style="height:12px" />
            <ScrollView scrollY style="max-height:48vh">
              {questions.map((q, i) => (
                <View
                  key={q.id}
                  onClick={() => goTo(i)}
                  style={`display:flex;gap:10px;padding:12px;border-radius:12px;margin-bottom:8px;${
                    i === qIdx ? "background:#EAF7F1" : "background:#F7F9F9"
                  }`}
                >
                  <Text style="font-size:13px;color:#2E9C97;min-width:48px">
                    {passed[i] ? "✓ " : ""}P{q.part}
                  </Text>
                  <Text style="font-size:13px;color:#374151;flex:1">{q.content}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}
