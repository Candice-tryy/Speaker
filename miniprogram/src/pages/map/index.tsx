import { useState } from "react";
import { View, Text, ScrollView, Button } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { getBank, type Part } from "../../lib/api";
import {
  accentFor,
  getSettings,
  isNodeDone,
  needForPart,
  nodeKey,
  setSettings,
} from "../../lib/store";
import "./index.scss";

const PART_LABELS: Record<string, string> = {
  "Part 1": "P1",
  "Part 2&3": "P2&3",
  "Part 2串题": "P2串题",
};
const BANDS = [5.5, 6.0, 6.5, 7.0, 7.5];

export default function Map() {
  const [parts, setParts] = useState<Part[]>([]);
  const [active, setActive] = useState(0);
  const [settings, setLocal] = useState(getSettings());
  const [, setTick] = useState(0);
  const [loadErr, setLoadErr] = useState(false);
  const [draftBand, setDraftBand] = useState(getSettings().targetBand);

  useDidShow(() => {
    setLocal(getSettings());
    setTick((t) => t + 1);
    if (parts.length === 0) loadBank();
  });

  function loadBank() {
    setLoadErr(false);
    getBank()
      .then((bank) => setParts(bank.parts))
      .catch(() => setLoadErr(true));
  }

  function finishOnboarding() {
    setLocal(setSettings({ onboarded: true, targetBand: draftBand }));
  }

  const part = parts[active];
  const need = part ? needForPart(part.name) : 1;

  function openNode(partName: string, peakIdx: number, nodeIdx: number, topicId: string) {
    Taro.navigateTo({
      url: `/pages/practice/index?part=${encodeURIComponent(
        partName
      )}&pi=${active}&peak=${peakIdx}&node=${nodeIdx}&topicId=${topicId}`,
    });
  }

  if (!settings.onboarded) {
    return (
      <View className="onboard">
        <View className="onboard-card">
          <View className="onboard-emoji">🏔️</View>
          <Text className="onboard-title">一起登顶雅思口语</Text>
          <Text className="onboard-sub">每天爬一段，把高频题用真人发音打分练熟。先定个目标分：</Text>
          <View className="onboard-bands">
            {BANDS.map((b) => (
              <Text
                key={b}
                onClick={() => setDraftBand(b)}
                className={`onboard-band ${draftBand === b ? "onboard-band-on" : ""}`}
              >
                {b.toFixed(1)}
              </Text>
            ))}
          </View>
          <Button className="onboard-go" onClick={finishOnboarding}>
            开始登山
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="map">
      <View className="hud">
        <View className="seg">
          {parts.map((p, i) => (
            <Text
              key={p.name}
              className={`seg-item ${i === active ? "seg-active" : ""}`}
              onClick={() => setActive(i)}
            >
              {PART_LABELS[p.name] || p.name}
            </Text>
          ))}
        </View>
        <View className="hud-right">
          <Text>🔥 {settings.streak}</Text>
          <Text>🎯 {settings.targetBand.toFixed(1)}</Text>
        </View>
      </View>

      <ScrollView scrollY style="height: calc(100vh - 64px)">
        {loadErr && (
          <View style="padding:40px;text-align:center">
            <Text style="color:#C9537F;font-size:14px">题库加载失败</Text>
            <View style="height:14px" />
            <Text
              onClick={loadBank}
              style="display:inline-block;background:#3FC196;color:#fff;padding:8px 20px;border-radius:999px;font-size:14px"
            >
              重试
            </Text>
          </View>
        )}
        {!part && !loadErr && (
          <View style="padding:48px;text-align:center;color:#1E7A66">加载中…</View>
        )}

        {part?.peaks.map((peak, peakIdx) => {
          const accent = accentFor(peakIdx);
          const currentIdx = peak.cards.findIndex(
            (_, i) => !isNodeDone(nodeKey(active, peakIdx, i), need)
          );
          return (
            <View className="peak" key={`${part.name}-${peakIdx}`}>
              <View className="peak-scene">
                <View className="peak-sun" />
                <View className="cloud cloud-a" />
                <View className="cloud cloud-b" />
                <View className="peak-mtn" />
                <View className="peak-snow" />
                <View className="climber">🧗</View>
              </View>
              <Text className="peak-name">{peak.name}</Text>
              <View className="nodes">
                {peak.cards.map((topic, nodeIdx) => {
                  const done = isNodeDone(nodeKey(active, peakIdx, nodeIdx), need);
                  const isCurrent = nodeIdx === currentIdx;
                  const label = peak.topics[nodeIdx] || topic.title;
                  return (
                    <View
                      className="node"
                      key={topic.id}
                      onClick={() => openNode(part.name, peakIdx, nodeIdx, topic.id)}
                    >
                      <View
                        className={`dot ${isCurrent ? "dot-current" : ""}`}
                        style={`background:${done ? "#3FC196" : accent.acc};--ring:${accent.deep}`}
                      >
                        {done ? "✓" : nodeIdx + 1}
                      </View>
                      <Text className="node-label">{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
