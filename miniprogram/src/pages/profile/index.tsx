import { useMemo, useRef, useState } from "react";
import { Image, View, Text, Textarea } from "@tarojs/components";
import Taro, { useDidShow, useRouter } from "@tarojs/taro";
import { ICONS, TREND_CHART } from "../../lib/icons.gen";
import { getProgress, getSettings, setSettings } from "../../lib/store";
import { capsuleCenteredTop, chromeInsets } from "../../lib/ui";
import "./index.scss";

const BANDS = [5.5, 6.0, 6.5, 7.0];
const PART_TOTALS = [
  { idx: 0, name: "Part 1", total: 60 },
  { idx: 1, name: "Part 2&3", total: 77 },
  { idx: 2, name: "Part 2串题", total: 13 },
];

export default function Profile() {
  const router = useRouter();
  const returnToPractice = router.params?.returnTo === "practice";
  const [settings, setLocal] = useState(getSettings());
  const [progress, setProgress] = useState(getProgress());
  const [persona, setPersona] = useState(getSettings().name || "");
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useMemo(() => chromeInsets(), []);

  useDidShow(() => {
    const latest = getSettings();
    setLocal(latest);
    setPersona(latest.name || "");
    setProgress(getProgress());
  });

  function showToast(message: string) {
    if (toastHideTimer.current) clearTimeout(toastHideTimer.current);
    if (toastClearTimer.current) clearTimeout(toastClearTimer.current);
    setToast(message);
    setToastVisible(false);
    setTimeout(() => setToastVisible(true), 30);
    toastHideTimer.current = setTimeout(() => setToastVisible(false), 1450);
    toastClearTimer.current = setTimeout(() => setToast(""), 1800);
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
    const value = persona.trim();
    setLocal(setSettings({ name: value }));
    showToast(value ? "人设已保存" : "已清空人设");
  }

  const totalDone = doneCount();
  const exp = totalDone * 20;

  // The floating back button lives at the top-right, so sharing the capsule's
  // row means centering on it vertically AND sliding left of its edge. Only
  // one button shows: back to wherever the user came from.
  const backStyle = `top:${capsuleCenteredTop(33)}px;right:${insets.right + 8}px`;

  return (
    <View className="profile-phone">
        {returnToPractice ? (
          <View className="practice-back" style={backStyle} onClick={() => Taro.navigateBack()}><Image className="icon" src={ICONS.cardDoc} /></View>
        ) : (
          <View className="map-back" style={backStyle} onClick={() => Taro.reLaunch({ url: "/pages/map/index" })}><Image className="icon" src={ICONS.mountain} /></View>
        )}

        <View className="body" style={`padding-top:${insets.top + 24}px`}>
          <View className="head">
            <View className="avatar">S</View>
            <View>
              <Text className="name">Candice</Text>
              <Text className="level">Lv.3 · 攀登者</Text>
            </View>
          </View>

          <View className="stats">
            <View className="stat"><Text className="stat-v">{settings.streak || 1}</Text><Text className="stat-l">连续天数</Text></View>
            <View className="stat"><Text className="stat-v">{totalDone}</Text><Text className="stat-l">已点亮关</Text></View>
            <View className="stat"><Text className="stat-v">{exp}</Text><Text className="stat-l">累计经验</Text></View>
          </View>

          <Text className="section-title">目标分</Text>
          <View className="card">
            <Text className="card-title">我的目标 band</Text>
            <Text className="card-desc">影响练习页通过线。后续接入语料难度、打分宽容度和词汇高亮权重。</Text>
            <View className="bands">
              {BANDS.map((band) => (
                <Text
                  key={band}
                  className={`band ${settings.targetBand === band ? "on" : ""}`}
                  onClick={() => pickBand(band)}
                >
                  {band.toFixed(1)}
                </Text>
              ))}
            </View>
          </View>

          <Text className="section-title">个性化人设</Text>
          <View className="card">
            <Text className="card-title">你的身份和爱好</Text>
            <Text className="card-desc">写一句关于你的描述，AI 生成范本时会代入“你”，让回答更真实自然。</Text>
            <Textarea
              className="persona-box"
              value={persona}
              onInput={(event) => setPersona(String(event.detail.value || ""))}
              placeholder="例如：我是一名爱爬山和摄影的大三学生，周末喜欢逛独立咖啡馆。"
            />
            <View className="save" onClick={savePersona}>保存人设</View>
          </View>

          <Text className="section-title">学习进度</Text>
          <View className="card">
            <View className="score-row">
              <View className="score-left">
                <Text className="score-strong">{settings.targetBand.toFixed(1)}</Text>
                <Text className="score-label">当前目标分</Text>
              </View>
              <Text className="score-xp">+{exp} XP</Text>
            </View>
            <Image className="chart" src={TREND_CHART} mode="scaleToFill" />
            {PART_TOTALS.map((part) => {
              const done = doneCount(part.idx);
              const pct = Math.min(100, Math.round((done / part.total) * 100));
              return (
                <View className="progress" key={part.name}>
                  <View className="progress-row">
                    <Text className="progress-name">{part.name}</Text>
                    <Text className="progress-count">{done} / {part.total} 关</Text>
                  </View>
                  <View className="bar"><View className="bar-fill" style={`width:${pct}%`} /></View>
                </View>
              );
            })}
          </View>

          <Text className="section-title">学习</Text>
          <View className="rows">
            <View className="row" onClick={() => showToast("生词本：28 个词")}>
              <View className="row-icon"><Image className="icon" src={ICONS.book} /></View>
              <Text className="row-name">生词本</Text>
              <Text className="row-meta">28 个词</Text>
            </View>
            <View className="row" onClick={() => showToast("每日提醒：20:00")}>
              <View className="row-icon"><Image className="icon" src={ICONS.bell} /></View>
              <Text className="row-name">每日练习提醒</Text>
              <Text className="row-meta">20:00</Text>
            </View>
          </View>
        </View>

        {toast ? <View className={`toast ${toastVisible ? "show" : ""}`}>{toast}</View> : null}
    </View>
  );
}
