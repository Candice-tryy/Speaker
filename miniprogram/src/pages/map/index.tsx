import { useState } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { getBank, type Part } from "../../lib/api";
import { accentFor, getProgress, getSettings, isNodeDone, needForPart, nodeKey } from "../../lib/store";
import "./index.scss";

const PART_LABELS: Record<string, string> = {
  "Part 1": "P1",
  "Part 2&3": "P2&3",
  "Part 2串题": "P2串题",
};

export default function Map() {
  const [parts, setParts] = useState<Part[]>([]);
  const [active, setActive] = useState(0);
  const [settings, setSettings] = useState(getSettings());
  const [progressTick, setProgressTick] = useState(0);

  // Refetch-light: load bank once, refresh progress every time the page shows
  // (so a node lit during practice appears done on return).
  useDidShow(() => {
    setSettings(getSettings());
    setProgressTick((t) => t + 1);
    if (parts.length === 0) {
      getBank()
        .then((bank) => setParts(bank.parts))
        .catch(() => Taro.showToast({ title: "题库加载失败", icon: "none" }));
    }
  });

  const part = parts[active];
  const need = part ? needForPart(part.name) : 1;

  function openNode(partName: string, peakIdx: number, nodeIdx: number, topicId: string) {
    Taro.navigateTo({
      url: `/pages/practice/index?part=${encodeURIComponent(
        partName
      )}&pi=${active}&peak=${peakIdx}&node=${nodeIdx}&topicId=${topicId}`,
    });
  }

  // touch progressTick so the memo recomputes after returning from practice
  void progressTick;
  const progress = getProgress();
  void progress;

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
        {!part && <View style="padding:48px;text-align:center;color:#1E7A66">加载中…</View>}

        {part?.peaks.map((peak, peakIdx) => {
          const accent = accentFor(peakIdx);
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
                  const key = nodeKey(active, peakIdx, nodeIdx);
                  const done = isNodeDone(key, need);
                  const label = peak.topics[nodeIdx] || topic.title;
                  return (
                    <View
                      className="node"
                      key={topic.id}
                      onClick={() => openNode(part.name, peakIdx, nodeIdx, topic.id)}
                    >
                      <View
                        className="dot"
                        style={`background:${done ? "#3FC196" : accent.acc}`}
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
