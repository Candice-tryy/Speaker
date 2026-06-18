"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./profile.module.css";

const TARGET_KEY = "speaker_target";
const PERSONA_KEY = "speaker_persona";
const PROGRESS_KEY = "speaker_progress";
const BANDS = ["5.5", "6.0", "6.5", "7.0"];
const PART_TOTALS = [60, 77, 13];

function readProgress(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [target, setTarget] = useState("6.5");
  const [persona, setPersona] = useState("");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [toast, setToast] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => {
      setTarget(localStorage.getItem(TARGET_KEY) || "6.5");
      setPersona(localStorage.getItem(PERSONA_KEY) || "");
      setProgress(readProgress());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const returnTo = searchParams.get("returnTo") || "";
  const returnToPractice = returnTo.startsWith("/practice") ? returnTo : "";
  const doneCount = useMemo(() => Object.values(progress).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0), [progress]);
  const exp = doneCount * 20;
  const partDone = [0, 1, 2].map((partIdx) =>
    Object.entries(progress)
      .filter(([key]) => key.startsWith(`${partIdx}-`))
      .reduce((sum, [, value]) => sum + Math.max(0, Number(value) || 0), 0)
  );

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }

  function chooseBand(value: string) {
    setTarget(value);
    localStorage.setItem(TARGET_KEY, value);
    showToast(`目标分已设为 ${value}`);
  }

  function savePersona() {
    const value = persona.trim();
    localStorage.setItem(PERSONA_KEY, value);
    showToast(value ? "人设已保存" : "已清空人设");
  }

  return (
    <div className={styles.frame}>
      <div className={styles.phone}>
        {returnToPractice ? (
          <button className={styles.practiceBack} aria-label="返回练习" onClick={() => router.push(returnToPractice)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="4" width="14" height="16" rx="2" />
              <path d="M9 8h6" />
              <path d="M9 12h6" />
              <path d="M9 16h3" />
            </svg>
          </button>
        ) : null}
        <button className={styles.mapBack} aria-label="返回登山" onClick={() => router.push("/map")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21l6-12 5 7 3-4 4 9z" />
          </svg>
        </button>

        <main className={styles.body}>
          <section className={styles.head}>
            <div className={styles.avatar}>S</div>
            <div>
              <h1>Candice</h1>
              <div className={styles.level}>Lv.3 · 攀登者</div>
            </div>
          </section>

          <section className={styles.stats} aria-label="学习概览">
            <div className={styles.stat}>
              <strong>7</strong>
              <span>连续天数</span>
            </div>
            <div className={styles.stat}>
              <strong>{doneCount}</strong>
              <span>已点亮关</span>
            </div>
            <div className={styles.stat}>
              <strong>{exp}</strong>
              <span>累计经验</span>
            </div>
          </section>

          <h2 className={styles.sectionTitle}>目标分</h2>
          <section className={styles.card}>
            <div className={styles.cardTitle}>我的目标 band</div>
            <p className={styles.cardDesc}>影响练习页通过线。后续接入语料难度、打分宽容度和词汇高亮权重。</p>
            <div className={styles.bands}>
              {BANDS.map((band) => (
                <button key={band} className={`${styles.band} ${target === band ? styles.on : ""}`} onClick={() => chooseBand(band)}>
                  {band}
                </button>
              ))}
            </div>
          </section>

          <h2 className={styles.sectionTitle}>个性化人设</h2>
          <section className={styles.card}>
            <div className={styles.cardTitle}>你的身份和爱好</div>
            <p className={styles.cardDesc}>写一句关于你的描述，AI 生成范本时会代入“你”，让回答更真实自然。</p>
            <textarea
              value={persona}
              onChange={(event) => setPersona(event.target.value)}
              placeholder="例如：我是一名爱爬山和摄影的大三学生，周末喜欢逛独立咖啡馆。"
            />
            <button className={styles.save} onClick={savePersona}>
              保存人设
            </button>
          </section>

          <h2 className={styles.sectionTitle}>学习进度</h2>
          <section className={styles.card}>
            <div className={styles.scoreRow}>
              <div>
                <strong>{target}</strong>
                <span>当前目标分</span>
              </div>
              <em>+{exp} XP</em>
            </div>
            <svg className={styles.chart} viewBox="0 0 280 56" preserveAspectRatio="none" aria-hidden="true">
              <polyline fill="none" stroke="#3FC196" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points="6,44 52,40 98,34 144,36 190,26 236,18 274,14" />
              <circle cx="274" cy="14" r="4.5" fill="#5DAEE6" />
            </svg>
            {["Part 1", "Part 2&3", "Part 2\u4e32\u9898"].map((part, idx) => {
              const count = partDone[idx] ?? 0;
              const total = PART_TOTALS[idx] ?? 1;
              const pct = Math.min(100, Math.round((count / total) * 100));
              return (
                <div className={styles.progress} key={part}>
                  <div>
                    <b>{part}</b>
                    <span>{count} / {total} 关</span>
                  </div>
                  <i>
                    <span style={{ width: `${pct}%` }} />
                  </i>
                </div>
              );
            })}
          </section>

          <h2 className={styles.sectionTitle}>学习</h2>
          <section className={styles.rows}>
            <button className={styles.row} onClick={() => showToast("生词本：28 个词")}>
              <span className={styles.rowIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h13a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z" />
                  <path d="M8 4v16" />
                </svg>
              </span>
              <span>生词本</span>
              <em>28 个词</em>
            </button>
            <button className={styles.row} onClick={() => showToast("每日提醒：20:00")}>
              <span className={styles.rowIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
              </span>
              <span>每日练习提醒</span>
              <em>20:00</em>
            </button>
          </section>
        </main>

        {toast ? <div className={`${styles.toast} ${styles.show}`}>{toast}</div> : null}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileContent />
    </Suspense>
  );
}
