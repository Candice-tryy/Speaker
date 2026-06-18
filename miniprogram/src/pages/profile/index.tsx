import { useState } from "react";
import { View, Text } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { getProgress, getSettings, setSettings } from "../../lib/store";

const BANDS = [5.5, 6.0, 6.5, 7.0, 7.5];
const SECTIONS = [
  { idx: 0, name: "Part 1", total: 60 },
  { idx: 1, name: "Part 2&3", total: 77 },
  { idx: 2, name: "Part 2串题", total: 13 },
];

export default function Profile() {
  const [settings, setLocal] = useState(getSettings());
  const [progress, setProgress] = useState(getProgress());

  useDidShow(() => {
    setLocal(getSettings());
    setProgress(getProgress());
  });

  function doneCount(partIdx: number): number {
    return Object.keys(progress).filter((k) => k.startsWith(`${partIdx}-`)).length;
  }

  function pickBand(b: number) {
    setLocal(setSettings({ targetBand: b }));
  }

  return (
    <View style="min-height:100vh;background:linear-gradient(180deg,#E7DEF8,#F3EFFB);padding:24px 20px">
      <View style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <View style="width:56px;height:56px;border-radius:50%;background:#9B82DC;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px">
          🧗
        </View>
        <View>
          <Text style="font-size:18px;font-weight:700;color:#4b3b7a">我的口语</Text>
          <View style="height:4px" />
          <Text style="font-size:13px;color:#6E54B8">🔥 连续 {settings.streak} 天</Text>
        </View>
      </View>

      <View style="background:#fff;border-radius:20px;padding:20px;margin-bottom:16px">
        <Text style="font-size:14px;font-weight:600;color:#4b3b7a">目标分</Text>
        <View style="height:12px" />
        <View style="display:flex;gap:8px;flex-wrap:wrap">
          {BANDS.map((b) => (
            <Text
              key={b}
              onClick={() => pickBand(b)}
              style={`padding:8px 14px;border-radius:999px;font-size:14px;${
                settings.targetBand === b
                  ? "background:#6E54B8;color:#fff;font-weight:600"
                  : "background:#F0EAF9;color:#6E54B8"
              }`}
            >
              {b.toFixed(1)}
            </Text>
          ))}
        </View>
      </View>

      <View style="background:#fff;border-radius:20px;padding:20px">
        <Text style="font-size:14px;font-weight:600;color:#4b3b7a">进度</Text>
        <View style="height:12px" />
        {SECTIONS.map((s) => {
          const done = doneCount(s.idx);
          const pct = Math.min(100, Math.round((done / s.total) * 100));
          return (
            <View key={s.name} style="margin-bottom:14px">
              <View style="display:flex;justify-content:space-between;margin-bottom:6px">
                <Text style="font-size:13px;color:#374151">{s.name}</Text>
                <Text style="font-size:13px;color:#6E54B8">
                  {done}/{s.total}
                </Text>
              </View>
              <View style="height:8px;background:#EFEAF8;border-radius:999px;overflow:hidden">
                <View style={`height:8px;width:${pct}%;background:#9B82DC;border-radius:999px`} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
