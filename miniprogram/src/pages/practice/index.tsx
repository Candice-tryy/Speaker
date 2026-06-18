import { useEffect, useState } from "react";
import { View, Text, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { getBank, scoreAudio, type Topic, type ScoreResult } from "../../lib/api";
import { startRecording, type RecordingController } from "../../lib/recorder";

type Phase = "loading" | "ready" | "recording" | "scoring" | "done" | "error";

export default function Practice() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [rec, setRec] = useState<RecordingController | null>(null);

  // Vertical slice: load the bank and take the first Part 2&3 cue card.
  useEffect(() => {
    getBank()
      .then((bank) => {
        const p23 = bank.parts.find((p) => p.name === "Part 2&3") || bank.parts[0];
        const card = p23?.peaks[0]?.cards[0] || null;
        setTopic(card);
        setPhase(card ? "ready" : "error");
        if (!card) setErrMsg("题库为空");
      })
      .catch((e) => {
        setErrMsg(String(e?.errMsg || e));
        setPhase("error");
      });
  }, []);

  // For 跟读, the user reads the Band7 model answer aloud; that text is the
  // reference 讯飞 scores against. Fall back to the question if no sample.
  const refText = topic?.questions[0]?.answer || topic?.questions[0]?.content || "";

  async function onStart() {
    try {
      const controller = await startRecording();
      setRec(controller);
      setPhase("recording");
    } catch (e) {
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
    } catch (e) {
      setErrMsg(String((e as any)?.errMsg || e));
      setPhase("error");
    } finally {
      setRec(null);
    }
  }

  function reset() {
    setResult(null);
    setPhase("ready");
  }

  if (phase === "loading") {
    return (
      <View style="padding:48px;text-align:center;color:#1E7A66">加载题库中…</View>
    );
  }

  if (phase === "error") {
    return (
      <View style="padding:32px;color:#C9537F">
        <Text>出错了：{errMsg}</Text>
      </View>
    );
  }

  return (
    <View style="min-height:100vh;background:#D9F0FF;padding:24px 20px;box-sizing:border-box">
      <View style="background:#fff;border-radius:20px;padding:20px;box-shadow:0 8px 24px rgba(46,156,151,0.12)">
        <Text style="font-size:13px;color:#2E9C97">{topic?.tag || "Part 2"}</Text>
        <View style="height:8px" />
        <Text style="font-size:17px;line-height:1.5;color:#1f2937">
          {topic?.questions[0]?.content}
        </Text>
      </View>

      <View style="height:16px" />

      <View style="background:#fff;border-radius:20px;padding:20px">
        <Text style="font-size:13px;color:#2E9C97">跟读这段（Band 7 范文）</Text>
        <View style="height:8px" />
        <Text style="font-size:15px;line-height:1.6;color:#374151">{refText}</Text>
      </View>

      <View style="height:28px" />

      {phase === "ready" && (
        <Button
          style="background:#3FC196;color:#fff;border-radius:999px;font-size:16px"
          onClick={onStart}
        >
          🎤 开始跟读
        </Button>
      )}

      {phase === "recording" && (
        <Button
          style="background:#EC7CA8;color:#fff;border-radius:999px;font-size:16px"
          onClick={onStop}
        >
          ⏹ 录音中…点此结束
        </Button>
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
              <Text style="font-size:40px;font-weight:700;color:#1E7A66">
                {result.band.toFixed(1)}
              </Text>
              <View style="height:6px" />
              <Text style="font-size:13px;color:#6b7280">
                发音 {result.pronunciation.toFixed(1)} · 流利度 {result.fluency.toFixed(1)}
                {result.source === "mock" ? " · (mock)" : ""}
              </Text>
              <View style="height:14px" />
              <Text style="font-size:15px;line-height:1.6;color:#374151">{result.advice}</Text>
            </View>
          )}
          <View style="height:20px" />
          <Button
            style="background:#3FC196;color:#fff;border-radius:999px"
            onClick={reset}
          >
            再来一次
          </Button>
        </View>
      )}
    </View>
  );
}
