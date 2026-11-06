import { useMemo, useRef, useState } from "react";
import { Image, View, Text } from "@tarojs/components";
import Taro, { useDidShow, useRouter } from "@tarojs/taro";
import { ICONS } from "../../lib/icons.gen";
import { getBank } from "../../lib/api";
import { getLitTopics, getSettings, litCountForPart, migrateLegacyProgress, setSettings } from "../../lib/store";
import { capsuleCenteredTop, chromeInsets } from "../../lib/ui";
import "./index.scss";

const BANDS = [5.5, 6.0, 6.5, 7.0];
export default function Profile() {
  const router = useRouter();
  const returnToPractice = router.params?.returnTo === "practice";
  const [settings, setLocal] = useState(getSettings());
  const [partTotals, setPartTotals] = useState<Array<{ idx: number; name: string; total: number; done: number }>>([]);
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useMemo(() => chromeInsets(), []);

  useDidShow(() => {
    const latest = getSettings();
    setLocal(latest);
    getBank().then((bank) => {
      migrateLegacyProgress(bank.parts);
      const lit = getLitTopics();
      setPartTotals(bank.parts.map((part, idx) => ({
        idx,
        name: part.name,
        total: part.peaks.reduce((sum, peak) => sum + peak.cards.length, 0),
        done: litCountForPart(lit, part),
      })));
    }).catch(() => setPartTotals([]));
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

  function pickBand(band: number) {
    setLocal(setSettings({ targetBand: band }));
    showToast(`目标分已设为 ${band.toFixed(1)}`);
  }

  const totalDone = partTotals.reduce((sum, part) => sum + part.done, 0);
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
              <Text className="name">口语攀登者</Text>
              <Text className="level">已点亮 {totalDone} 关</Text>
            </View>
          </View>

          <View className="stats">
            <View className="stat"><Text className="stat-v">{settings.streak || 0}</Text><Text className="stat-l">连续使用天数</Text></View>
            <View className="stat"><Text className="stat-v">{totalDone}</Text><Text className="stat-l">已点亮关</Text></View>
            <View className="stat"><Text className="stat-v">{exp}</Text><Text className="stat-l">累计经验</Text></View>
          </View>

          <Text className="section-title">目标分</Text>
          <View className="card">
            <Text className="card-title">我的目标 band</Text>
            <Text className="card-desc">练习达到目标分以下 0.5 分即可完成当前题目。</Text>
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

          <Text className="section-title">学习进度</Text>
          <View className="card">
            <View className="score-row">
              <View className="score-left">
                <Text className="score-strong">{settings.targetBand.toFixed(1)}</Text>
                <Text className="score-label">当前目标分</Text>
              </View>
              <Text className="score-xp">+{exp} XP</Text>
            </View>
            {partTotals.map((part) => {
              const done = part.done;
              const pct = part.total ? Math.min(100, Math.round((done / part.total) * 100)) : 0;
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

        </View>

        {toast ? <View className={`toast ${toastVisible ? "show" : ""}`}>{toast}</View> : null}
    </View>
  );
}
