import { useEffect, useMemo, useRef, useState } from "react";
import { Image, View, Text, Textarea } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { getBank, type Part } from "../../lib/api";
import { ICONS, MIST } from "../../lib/icons.gen";
import { buildScene, svgToDataUrl, type SceneNode } from "../../lib/scene";
import { getProgress, getSettings, setSettings, touchStreak } from "../../lib/store";
import { capsuleCenteredTop, chromeInsets } from "../../lib/ui";
import "./index.scss";

const ALT = [1200, 2480, 3760];
const SKIES = ["sky-a", "sky-b", "sky-c"];
const ENABLE_DAILY_REVIEW = false;

function isTopicSet(name: string) {
  return name === "Part 1" || name === "Part 2&3" || name === "Part 2串题";
}

function displayPartName(value: string): string {
  return value.replace(/^Part\s*/g, "");
}

type TouchLike = { clientX: number; clientY: number };

function touchPoint(event: unknown, listName: "touches" | "changedTouches"): TouchLike | null {
  const record = event as Partial<Record<"touches" | "changedTouches", ArrayLike<TouchLike>>>;
  const touch = record[listName]?.[0];
  return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
}

export default function Map() {
  const [parts, setParts] = useState<Part[]>([]);
  const [partIdx, setPartIdx] = useState(1);
  const [peakIdx, setPeakIdx] = useState(0);
  const [prog, setProg] = useState<Record<string, number>>(getProgress());
  const [settings, setLocal] = useState(getSettings());
  const [persona, setPersona] = useState("");
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [sceneAnim, setSceneAnim] = useState<"" | "exitUp" | "enterDown">("");
  const [mist, setMist] = useState<{ key: number; dir: "up" | "down" } | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const animatingRef = useRef(false);
  const toastHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const insets = useMemo(() => chromeInsets(), []);

  useEffect(() => {
    setLocal(getSettings().onboarded ? touchStreak() : getSettings());
    loadBank();
  }, []);

  // Returning from practice/profile: refresh progress + settings, and celebrate
  // a freshly lit node (the web version does this via the ?done=1 round-trip).
  useDidShow(() => {
    const latest = getProgress();
    const key = `${partIdx}-${peakIdx}`;
    const prev = Math.max(0, Number(prog[key] || 0));
    const next = Math.max(0, Number(latest[key] || 0));
    if (next > prev) {
      const label = parts[partIdx]?.peaks[peakIdx]?.topics[next - 1] || "关卡";
      setTimeout(() => showToast(`🎉 ${label} 点亮成功！+20 经验`), 350);
    }
    setProg(latest);
    setLocal(getSettings());
  });

  const part = parts[partIdx];
  const peak = part?.peaks[peakIdx];
  const total = part?.peaks.length || 0;
  const peakDone = Math.max(0, Number(prog[`${partIdx}-${peakIdx}`] ?? peak?.done ?? 0));

  // The scene renders as a local SVG data URL — no network dependency, and
  // verified to render on real devices. (/api/scene serves the same scene as
  // PNG if an SVG-incompatible client ever shows up.)
  const scene = useMemo(
    () => (peak ? buildScene(peak, peakDone, peakIdx, total, part?.name || "") : null),
    [peak, peakDone, peakIdx, total, part?.name]
  );
  const sceneSrc = useMemo(() => (scene ? svgToDataUrl(scene.svg) : ""), [scene]);

  function showToast(message: string) {
    if (toastHideTimer.current) clearTimeout(toastHideTimer.current);
    if (toastClearTimer.current) clearTimeout(toastClearTimer.current);
    setToast(message);
    setToastVisible(false);
    setTimeout(() => setToastVisible(true), 30);
    toastHideTimer.current = setTimeout(() => setToastVisible(false), 1450);
    toastClearTimer.current = setTimeout(() => setToast(""), 1800);
  }

  function loadBank() {
    getBank()
      .then((bank) => {
        const nextParts = bank.parts;
        setParts(nextParts);
        setPartIdx(Math.min(1, Math.max(0, nextParts.length - 1)));
        setPeakIdx(0);
        if (!bank.loaded) showToast("题库读取失败，已使用内置备用题");
      })
      .catch(() => {
        setParts([]);
        showToast("题库读取失败，已使用内置备用题");
      });
  }

  function finishOnboarding() {
    setLocal(setSettings({ onboarded: true, name: persona.trim() || settings.name }));
  }

  function switchPeak(dir: number) {
    if (animatingRef.current) return;
    const next = peakIdx + dir;
    if (next < 0 || next >= total) {
      showToast(dir > 0 ? "山顶风景已收集完啦" : "已在山脚");
      return;
    }
    animatingRef.current = true;
    setMist({ key: Date.now(), dir: dir > 0 ? "down" : "up" });
    setSceneAnim(dir > 0 ? "enterDown" : "exitUp");
    setTimeout(() => {
      setPeakIdx(next);
      setSceneAnim(dir > 0 ? "exitUp" : "enterDown");
      setTimeout(() => {
        setSceneAnim("");
        animatingRef.current = false;
      }, 32);
    }, 300);
  }

  function switchPart(dir: number) {
    const next = partIdx + dir;
    if (next < 0 || next >= parts.length) {
      showToast(dir > 0 ? "已经是最后一个 Part" : "已经是第一个 Part");
      return;
    }
    setPartIdx(next);
    setPeakIdx(0);
  }

  function onNodeTap(node: SceneNode) {
    if (!peak) return;
    if (node.state === "lock") {
      showToast(node.isBoss ? "🔒 先清完本峰 3 关再战 Boss" : "🔒 先过前面的关卡");
      return;
    }
    if (!isTopicSet(part?.name || "") && node.i === 3) {
      showToast("😺 考官 Boss 即将上线");
      return;
    }
    const card = peak.cards[node.i];
    const partName = part?.name || "Part 2&3";
    Taro.navigateTo({
      url:
        `/pages/practice/index?part=${encodeURIComponent(partName)}` +
        `&pi=${partIdx}&peak=${peakIdx}&node=${node.i}&topicId=${encodeURIComponent(card?.id || "")}`,
    });
  }

  return (
    <View className={`map-phone ${SKIES[Math.min(peakIdx, SKIES.length - 1)]}`}>
        <View
          className="map-stage"
          onTouchStart={(event) => {
            const touch = touchPoint(event, "touches");
            touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
          }}
          onTouchEnd={(event) => {
            if (touchStart.current === null) return;
            const touch = touchPoint(event, "changedTouches");
            const dx = (touch?.clientX ?? touchStart.current.x) - touchStart.current.x;
            const dy = (touch?.clientY ?? touchStart.current.y) - touchStart.current.y;
            touchStart.current = null;
            if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) switchPart(dx < 0 ? 1 : -1);
            else if (Math.abs(dy) > 55) switchPeak(dy > 0 ? 1 : -1);
          }}
        >
          <View className={`scene ${sceneAnim}`}>
            {sceneSrc ? <Image className="scene-img" src={sceneSrc} mode="scaleToFill" /> : null}
            {scene?.nodes.map((node) => (
              <View
                key={node.i}
                className="node-hit"
                style={`left:${(node.x / 340) * 100}vw;top:${(node.y / 720) * 100}vh`}
                onClick={() => onNodeTap(node)}
              />
            ))}
          </View>
          {mist ? (
            <Image key={mist.key} className={`mist ${mist.dir === "up" ? "up" : "down"}`} src={MIST} mode="scaleToFill" />
          ) : null}
        </View>

        {/* Left column rises to the capsule row (nothing occupies the top-left),
            while the actions stay below the capsule to avoid colliding with it. */}
        <View className="hud" style={`padding-top:${insets.top}px`}>
          <View className="hud-main">
            <View className="parts">
              {parts.map((item, idx) => (
                <Text
                  key={item.name}
                  className={`part ${idx === partIdx ? "active" : ""}`}
                  onClick={() => {
                    setPartIdx(idx);
                    setPeakIdx(0);
                  }}
                >
                  <Text className="part-prefix">P</Text>
                  {displayPartName(item.name)}
                </Text>
              ))}
            </View>
            <View className="metrics">
              <View className="metric"><Image className="icon" src={ICONS.targetWhite} /><Text>Target <Text className="strong">{settings.targetBand.toFixed(1)}</Text></Text></View>
              <View className="metric"><Image className="icon" src={ICONS.altWhite} /><Text><Text className="strong">{ALT[Math.min(peakIdx, ALT.length - 1)].toLocaleString()}</Text>m</Text></View>
            </View>
          </View>
          <View className="hud-actions" style={`margin-top:${Math.max(0, insets.bottom + 6 - insets.top)}px`}>
            <View className="spark"><Image className="icon" src={ICONS.spark} /><Text>{settings.streak || 1}</Text></View>
            <View className="settings" onClick={() => Taro.navigateTo({ url: "/pages/profile/index" })}>
              <Image className="icon" src={ICONS.gearBlue} />
            </View>
          </View>
        </View>

        {peakIdx < total - 1 ? (
          <View className="hint"><Image className="icon" src={ICONS.chevronUpWhite} /></View>
        ) : null}

        {ENABLE_DAILY_REVIEW ? (
          <View className="bottom">
          <View className="review" onClick={() => showToast("🎁 今日复习补给 · +20 经验")}>
            <View className="ic">🎁</View>
            <View className="review-copy">
              <View className="t1">Daily review</View>
              <View className="t2">点亮 +20 经验 · 1 关</View>
            </View>
            <Text className="arr">›</Text>
          </View>
          </View>
        ) : null}

        {toast ? <View className={`toast ${toastVisible ? "show" : ""}`}>{toast}</View> : null}

        {!settings.onboarded && (
          <View className="onboard">
            <View className="ob-card">
              <Text className="em">👋</Text>
              <Text className="ob-title">先告诉我你是谁</Text>
              <Text className="ob-sub">写一句你的身份和爱好，AI 会据此生成更像「你」的口语范本。之后随时能在「我的」里修改。</Text>
              <Textarea
                className="ob-input"
                value={persona}
                onInput={(event) => setPersona(String(event.detail.value || ""))}
                placeholder="例：我是一名爱爬山和摄影的大三学生，养了只猫，周末喜欢逛独立咖啡馆。"
              />
              <View className="ob-go" onClick={finishOnboarding}>开始攀登</View>
              <Text className="ob-skip" onClick={finishOnboarding}>先跳过，稍后再填</Text>
            </View>
          </View>
        )}
    </View>
  );
}
