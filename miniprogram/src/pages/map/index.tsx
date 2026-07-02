import { useEffect, useState } from "react";
import { View, Text, Textarea } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { FALLBACK_PARTS, getBank, type Part } from "../../lib/api";
import { getSettings, isNodeDone, needForPart, nodeKey, setSettings, touchStreak } from "../../lib/store";
import "./index.scss";

const ROUTES = [
  [
    { x: 138, y: 874 },
    { x: 474, y: 760 },
    { x: 246, y: 628 },
    { x: 540, y: 474 },
    { x: 332, y: 332 },
  ],
  [
    { x: 188, y: 884 },
    { x: 506, y: 756 },
    { x: 280, y: 626 },
    { x: 526, y: 486 },
    { x: 430, y: 326 },
  ],
  [
    { x: 116, y: 870 },
    { x: 304, y: 760 },
    { x: 550, y: 632 },
    { x: 296, y: 494 },
    { x: 514, y: 332 },
  ],
];
const SKIES = ["sky-a", "sky-b", "sky-c"];
const BANDS = [5.5, 6.0, 6.5, 7.0, 7.5];

function shortLabel(value = "Practice") {
  return value.length > 10 ? `${value.slice(0, 9)}...` : value;
}

function partLabel(name: string) {
  if (name === "Part 1") return "P1";
  if (name === "Part 2&3") return "P2&3";
  if (name.includes("串题") || name.includes("涓查")) return "P2串题";
  return name.replace("Part ", "P");
}

function routeFor(count: number, peakIdx: number) {
  const base = ROUTES[peakIdx % ROUTES.length];
  return count <= base.length ? base.slice(0, count) : base;
}

export default function Map() {
  const [parts, setParts] = useState<Part[]>(FALLBACK_PARTS);
  const [partIdx, setPartIdx] = useState(1);
  const [peakIdx, setPeakIdx] = useState(0);
  const [settings, setLocal] = useState(getSettings());
  const [draftBand, setDraftBand] = useState(getSettings().targetBand);
  const [persona, setPersona] = useState("");
  const [toast, setToast] = useState("");
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    setLocal(getSettings().onboarded ? touchStreak() : getSettings());
    loadBank();
  }, []);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 1600);
  }

  function loadBank() {
    setLoadErr(false);
    getBank()
      .then((bank) => {
        setParts(bank.parts.length > 0 ? bank.parts : FALLBACK_PARTS);
        setPartIdx(Math.min(1, Math.max(0, (bank.parts.length || FALLBACK_PARTS.length) - 1)));
        setPeakIdx(0);
      })
      .catch(() => setLoadErr(true));
  }

  function finishOnboarding() {
    setLocal(setSettings({ onboarded: true, targetBand: draftBand, name: persona.trim() || settings.name }));
  }

  function switchPeak(dir: number) {
    const total = parts[partIdx]?.peaks.length || 0;
    const next = peakIdx + dir;
    if (next < 0 || next >= total) {
      showToast(dir > 0 ? "已经是最高峰" : "已经在山脚");
      return;
    }
    setPeakIdx(next);
  }

  function openNode(nodeIdx: number, topicId: string) {
    const partName = parts[partIdx]?.name || "Part 2&3";
    Taro.navigateTo({
      url:
        `/pages/practice/index?part=${encodeURIComponent(partName)}` +
        `&pi=${partIdx}&peak=${peakIdx}&node=${nodeIdx}&topicId=${encodeURIComponent(topicId)}`,
    });
  }

  const part = parts[partIdx];
  const peak = part?.peaks[peakIdx];
  const need = part ? needForPart(part.name) : 1;
  const nodes = routeFor(peak?.cards.length || 0, peakIdx);

  return (
    <View className={`map-shell ${SKIES[peakIdx % SKIES.length]}`}>
      <View className="map-stage">
        <View className="sun" />
        <View className="cloud cloud-one" />
        <View className="cloud cloud-two" />
        <View className="bird bird-one">⌁</View>
        <View className="bird bird-two">⌁</View>

        <View className="mountain mountain-back" />
        <View className="mountain mountain-mid" />
        <View className="mountain mountain-front" />
        <View className="snow snow-one" />
        <View className="snow snow-two" />
        <View className="flower flower-a" />
        <View className="flower flower-b" />
        <View className="flower flower-c" />

        <View className="route-line route-shadow" />
        <View className="route-line" />

        {peak?.cards.slice(0, nodes.length).map((topic, nodeIdx) => {
          const p = nodes[nodeIdx];
          const key = nodeKey(partIdx, peakIdx, nodeIdx);
          const done = isNodeDone(key, need);
          const current = !done && peak.cards.slice(0, nodeIdx).every((_, i) => isNodeDone(nodeKey(partIdx, peakIdx, i), need));
          return (
            <View
              key={topic.id}
              className={`map-node ${done ? "done" : current ? "current" : "locked"}`}
              style={`left:${p.x}rpx;top:${p.y}rpx`}
              onClick={() => {
                if (!done && !current) {
                  showToast("先过前面的关卡");
                  return;
                }
                openNode(nodeIdx, topic.id);
              }}
            >
              <Text className="node-label">{shortLabel(peak.topics[nodeIdx] || topic.title)}</Text>
              <View className="node-dot">{done ? "✓" : current ? "人" : nodeIdx + 1}</View>
            </View>
          );
        })}

        <View className="map-hud">
          <View className="part-tabs">
            {parts.map((item, idx) => (
              <Text
                key={item.name}
                className={`part-tab ${idx === partIdx ? "active" : ""}`}
                onClick={() => {
                  setPartIdx(idx);
                  setPeakIdx(0);
                }}
              >
                {partLabel(item.name)}
              </Text>
            ))}
          </View>
          <View className="hud-metrics">
            <Text>Target {settings.targetBand.toFixed(1)}</Text>
            <Text>{1200 + peakIdx * 1280}m</Text>
          </View>
        </View>

        <View className="hud-actions">
          <View className="streak-pill">
            <Text className="flame">🔥</Text>
            <Text>{settings.streak || 1}</Text>
          </View>
          <View className="round-btn" onClick={() => Taro.navigateTo({ url: "/pages/profile/index" })}>⚙</View>
        </View>

        <View className="peak-title">
          <Text>{peak?.name || (loadErr ? "题库加载失败" : "加载中...")}</Text>
        </View>
        <View className="swipe-hint" onClick={() => switchPeak(1)}>⌃</View>

        <View className="review-card" onClick={() => showToast("今日复习补给 +20 经验")}>
          <View className="review-icon">★</View>
          <View className="review-copy">
            <Text className="review-title">Daily review</Text>
            <Text className="review-sub">点亮 +20 经验 · 1 关</Text>
          </View>
          <Text className="review-arrow">›</Text>
        </View>

        {loadErr && (
          <View className="retry" onClick={loadBank}>
            <Text>题库加载失败，点此重试</Text>
          </View>
        )}
        {toast ? <View className="toast">{toast}</View> : null}
      </View>

      {!settings.onboarded && (
        <View className="onboard-mask">
          <View className="onboard-card">
            <Text className="onboard-emoji">👋</Text>
            <Text className="onboard-title">先告诉我你是谁</Text>
            <Text className="onboard-sub">写一句身份和爱好，后面生成范文时会更像你自己的表达。</Text>
            <Textarea
              className="persona-input"
              value={persona}
              onInput={(event) => setPersona(String(event.detail.value || ""))}
              placeholder="例如：我是一名爱爬山和摄影的大三学生。"
            />
            <View className="band-row">
              {BANDS.map((band) => (
                <Text
                  key={band}
                  className={`band-chip ${draftBand === band ? "active" : ""}`}
                  onClick={() => setDraftBand(band)}
                >
                  {band.toFixed(1)}
                </Text>
              ))}
            </View>
            <View className="onboard-go" onClick={finishOnboarding}>开始攀登</View>
            <Text className="onboard-skip" onClick={finishOnboarding}>先跳过，稍后再填</Text>
          </View>
        </View>
      )}
    </View>
  );
}
