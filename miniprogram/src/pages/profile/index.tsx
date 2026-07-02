import { useState } from "react";
import { View, Text, Textarea } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { getProgress, getSettings, setSettings } from "../../lib/store";
import "./index.scss";

const BANDS = [5.5, 6.0, 6.5, 7.0, 7.5];
const PART_TOTALS = [
  { idx: 0, name: "Part 1", total: 60 },
  { idx: 1, name: "Part 2&3", total: 77 },
  { idx: 2, name: "Part 2串题", total: 13 },
];

export default function Profile() {
  const [settings, setLocal] = useState(getSettings());
  const [progress, setProgress] = useState(getProgress());
  const [persona, setPersona] = useState(getSettings().name || "");
  const [toast, setToast] = useState("");

  useDidShow(() => {
    const latest = getSettings();
    setLocal(latest);
    setPersona(latest.name || "");
    setProgress(getProgress());
  });

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 1500);
  }

  function doneCount(partIdx?: number): number {
    return Object.entries(progress)
      .filter(([key]) => partIdx === undefined || key.startsWith(`${partIdx}-`))
      .reduce((sum, [, value]) => sum + Math.max(0, Number(value) || 0), 0);
  }

  function pickBand(band: number) {
    setLocal(setSettings({ targetBand: band }));
    showToast(`目标分已设为 ${band.toFixed(1)}`);
  }

  function savePersona() {
    setLocal(setSettings({ name: persona.trim() }));
    showToast(persona.trim() ? "人设已保存" : "已清空人设");
  }

  const totalDone = doneCount();
  const exp = totalDone * 20;

  return (
    <View className="profile-shell">
      <View className="profile-actions">
        <View className="round-action" onClick={() => Taro.navigateBack()}>‹</View>
        <View className="round-action" onClick={() => Taro.reLaunch({ url: "/pages/map/index" })}>⛰</View>
      </View>

      <View className="profile-body">
        <View className="profile-head">
          <View className="avatar">S</View>
          <View>
            <Text className="profile-name">Candice</Text>
            <Text className="profile-level">Lv.3 · 攀登者</Text>
          </View>
        </View>

        <View className="stat-grid">
          <View><Text>{settings.streak || 1}</Text><Text>连续天数</Text></View>
          <View><Text>{totalDone}</Text><Text>已点亮关</Text></View>
          <View><Text>{exp}</Text><Text>累计经验</Text></View>
        </View>

        <Text className="section-title">目标分</Text>
        <View className="profile-card">
          <Text className="card-title">我的目标 band</Text>
          <Text className="card-desc">影响练习页通关线。后续会接入语料难度、打分宽容度和词汇高亮权重。</Text>
          <View className="band-row">
            {BANDS.map((band) => (
              <Text
                key={band}
                className={`band-chip ${settings.targetBand === band ? "active" : ""}`}
                onClick={() => pickBand(band)}
              >
                {band.toFixed(1)}
              </Text>
            ))}
          </View>
        </View>

        <Text className="section-title">个性化人设</Text>
        <View className="profile-card">
          <Text className="card-title">你的身份和爱好</Text>
          <Text className="card-desc">写一句关于你的描述，AI 生成范文时会代入“你”，让回答更自然。</Text>
          <Textarea
            className="persona-box"
            value={persona}
            onInput={(event) => setPersona(String(event.detail.value || ""))}
            placeholder="例如：我是一名爱爬山和摄影的大三学生。"
          />
          <View className="save-btn" onClick={savePersona}>保存人设</View>
        </View>

        <Text className="section-title">学习进度</Text>
        <View className="profile-card">
          <View className="score-row">
            <View><Text>{settings.targetBand.toFixed(1)}</Text><Text>当前目标分</Text></View>
            <Text>+{exp} XP</Text>
          </View>
          <View className="chart-line" />
          {PART_TOTALS.map((part) => {
            const done = doneCount(part.idx);
            const pct = Math.min(100, Math.round((done / part.total) * 100));
            return (
              <View className="progress-row" key={part.name}>
                <View>
                  <Text>{part.name}</Text>
                  <Text>{done} / {part.total} 关</Text>
                </View>
                <View className="bar"><View style={`width:${pct}%`} /></View>
              </View>
            );
          })}
        </View>
      </View>

      {toast ? <View className="profile-toast">{toast}</View> : null}
    </View>
  );
}
