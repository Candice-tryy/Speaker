"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Part, Peak } from "@/lib/types";
import styles from "../map.module.css";

const FOOT = { x: 34, y: 612 };
const STANDARD_NODE_POS = [
  { x: 132, y: 552 },
  { x: 230, y: 486 },
  { x: 116, y: 412 },
  { x: 260, y: 302 },
];
const PART1_ROUTES = [
  [
    { x: 62, y: 606 },
    { x: 194, y: 568 },
    { x: 86, y: 526 },
    { x: 262, y: 486 },
    { x: 134, y: 432 },
    { x: 288, y: 382 },
    { x: 226, y: 286 },
  ],
  [
    { x: 94, y: 606 },
    { x: 244, y: 566 },
    { x: 156, y: 520 },
    { x: 292, y: 478 },
    { x: 174, y: 424 },
    { x: 268, y: 374 },
    { x: 240, y: 278 },
  ],
  [
    { x: 52, y: 598 },
    { x: 142, y: 560 },
    { x: 276, y: 520 },
    { x: 118, y: 470 },
    { x: 246, y: 420 },
    { x: 158, y: 366 },
    { x: 252, y: 282 },
  ],
];
const COMBO_ROUTES = [
  [
    { x: 116, y: 548 },
    { x: 244, y: 458 },
    { x: 142, y: 368 },
    { x: 260, y: 278 },
  ],
  [
    { x: 132, y: 552 },
    { x: 226, y: 480 },
    { x: 118, y: 394 },
    { x: 252, y: 282 },
  ],
  [
    { x: 102, y: 546 },
    { x: 236, y: 470 },
    { x: 168, y: 382 },
    { x: 266, y: 280 },
  ],
];
const ALT = [1200, 2480, 3760];
const NODE_LABEL_PADDING = 9;
const NODE_LABEL_UNIT_PX = 10.4;
const NODE_LABEL_MIN_WIDTH = 46;
const NODE_LABEL_MAX_WIDTH = 142;
const NODE_LABEL_SCREEN_MARGIN = 10;
const NODE_LABEL_MAX_UNITS = (NODE_LABEL_MAX_WIDTH - NODE_LABEL_PADDING * 2) / NODE_LABEL_UNIT_PX;
const SKIES = [
  "linear-gradient(180deg,#8FD3EF 0%,#AEE0F2 24%,#D4EFEC 54%,#E9F7E4 76%,#F4EFDF 100%)",
  "linear-gradient(180deg,#7CC8EE 0%,#A2DAF1 24%,#CDEBEC 54%,#E6F5E6 78%,#F3F0E2 100%)",
  "linear-gradient(180deg,#6FBEEC 0%,#97D2F0 24%,#C7E7EC 54%,#E2F3E8 78%,#F1F0E5 100%)",
];
const PKEY = "speaker_progress";

function escapeXml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

function routePath(points: Array<{ x: number; y: number }>): string {
  const all = [FOOT, ...points];
  return all
    .map((point, index) => {
      if (index === 0) return `M${point.x} ${point.y}`;
      const prev = all[index - 1];
      const midY = (prev.y + point.y) / 2;
      const bend = index % 2 === 0 ? 36 : -36;
      return `C${prev.x + bend} ${midY} ${point.x - bend} ${midY} ${point.x} ${point.y}`;
    })
    .join(" ");
}
function part1RoutePositions(count: number, routeIndex: number): Array<{ x: number; y: number }> {
  const route = PART1_ROUTES[routeIndex % PART1_ROUTES.length];
  if (count >= route.length) return route;
  if (count <= 1) return [route[route.length - 1]];
  return Array.from({ length: count }, (_, index) => {
    const routePoint = Math.round((index * (route.length - 1)) / (count - 1));
    return route[routePoint];
  });
}

function comboRoutePositions(count: number, routeIndex: number): Array<{ x: number; y: number }> {
  const route = COMBO_ROUTES[routeIndex % COMBO_ROUTES.length];
  if (count >= route.length) return route;
  if (count <= 1) return [route[route.length - 1]];
  return Array.from({ length: count }, (_, index) => {
    const routePoint = Math.round((index * (route.length - 1)) / (count - 1));
    return route[routePoint];
  });
}

function part1PathD(points: Array<{ x: number; y: number }>, routeIndex: number): string {
  const controlSets = [
    [
      { c1: { x: 44, y: 624 }, c2: { x: 42, y: 606 } },
      { c1: { x: 92, y: 596 }, c2: { x: 166, y: 604 } },
      { c1: { x: 236, y: 548 }, c2: { x: 96, y: 560 } },
      { c1: { x: 122, y: 508 }, c2: { x: 242, y: 524 } },
      { c1: { x: 294, y: 456 }, c2: { x: 124, y: 474 } },
      { c1: { x: 170, y: 408 }, c2: { x: 286, y: 428 } },
      { c1: { x: 314, y: 356 }, c2: { x: 226, y: 342 } },
    ],
    [
      { c1: { x: 52, y: 628 }, c2: { x: 72, y: 612 } },
      { c1: { x: 126, y: 594 }, c2: { x: 236, y: 610 } },
      { c1: { x: 278, y: 540 }, c2: { x: 146, y: 554 } },
      { c1: { x: 186, y: 502 }, c2: { x: 300, y: 520 } },
      { c1: { x: 316, y: 454 }, c2: { x: 178, y: 468 } },
      { c1: { x: 160, y: 402 }, c2: { x: 262, y: 416 } },
      { c1: { x: 292, y: 346 }, c2: { x: 240, y: 336 } },
    ],
    [
      { c1: { x: 44, y: 620 }, c2: { x: 46, y: 606 } },
      { c1: { x: 80, y: 584 }, c2: { x: 130, y: 594 } },
      { c1: { x: 182, y: 546 }, c2: { x: 272, y: 558 } },
      { c1: { x: 308, y: 492 }, c2: { x: 130, y: 512 } },
      { c1: { x: 88, y: 448 }, c2: { x: 236, y: 466 } },
      { c1: { x: 282, y: 396 }, c2: { x: 160, y: 410 } },
      { c1: { x: 138, y: 342 }, c2: { x: 248, y: 334 } },
    ],
  ];
  const controls = controlSets[routeIndex % controlSets.length];
  const all = [FOOT, ...points];
  return all
    .map((point, index) => {
      if (index === 0) return `M${point.x} ${point.y}`;
      const control = controls[index - 1];
      return `C${control.c1.x} ${control.c1.y} ${control.c2.x} ${control.c2.y} ${point.x} ${point.y}`;
    })
    .join(" ");
}
function nextPathD(): string {
  const p = STANDARD_NODE_POS[3];
  return `M${p.x} ${p.y} C300 286 306 248 346 226 C364 216 378 208 396 196`;
}
function entryPathD(): string {
  const f = FOOT;
  return `M-42 668 C-8 656 4 630 ${f.x} ${f.y}`;
}

function labelUnits(value: string): number {
  return Array.from(value).reduce((sum, char) => {
    if (char === " ") return sum + 0.35;
    if (/[\x00-\x7F]/.test(char)) return sum + 0.62;
    return sum + 1;
  }, 0);
}

function fitNodeLabel(value: string, maxUnits = NODE_LABEL_MAX_UNITS): string {
  const chars = Array.from(value);
  if (labelUnits(value) <= maxUnits) return value;
  let out = "";
  let units = 0;
  for (const char of chars) {
    const next = labelUnits(char);
    if (units + next > maxUnits - 1) break;
    out += char;
    units += next;
  }
  return `${out}...`;
}

function displayPartName(value: string): string {
  return value.replace(/^Part\s*/g, "");
}

function partNumber(partName: string): number {
  return partName === "Part 1" ? 1 : partName === "Part 3" ? 3 : partName === "Part 2涓查" ? 4 : 2;
}

function practiceHref(peak: Peak, partIdx: number, peakIdx: number, nodeIdx: number, partName: string): string {
  const card = peak.cards[nodeIdx];
  const partNo = partNumber(partName);
  const question = card?.questions?.find((q) => q.part === partNo) || card?.questions?.[0];
  const label = peak.topics[nodeIdx] || "Practice";
  return (
    `/practice?p=${partIdx}&pk=${peakIdx}&n=${nodeIdx}` +
    `&part=${encodeURIComponent(partName)}` +
    `&topic=${encodeURIComponent(label)}` +
    (card ? `&topicId=${encodeURIComponent(card.id)}` : "") +
    (question ? `&questionId=${encodeURIComponent(question.id)}` : "")
  );
}

function buildScene(peak: Peak, pdone: number, ki: number, total: number, partName: string, partIdx: number): string {
  const isTopicSet = partName === "Part 1" || partName === "Part 2&3" || partName === "Part 2串题";
  const isCombo = partName === "Part 2串题";
  const nodePos = isCombo ? comboRoutePositions(peak.cards.length, ki) : isTopicSet ? part1RoutePositions(peak.cards.length, ki) : STANDARD_NODE_POS;
  const mainPath = isTopicSet ? (isCombo ? routePath(nodePos) : part1PathD(nodePos, ki)) : routePath(nodePos);
  const onwardPath = isTopicSet
    ? `M${nodePos[nodePos.length - 1]?.x || 220} ${nodePos[nodePos.length - 1]?.y || 320} C258 302 306 318 340 286`
    : nextPathD();
  const nodes = nodePos.map((p, i) => {
    const isBoss = !isTopicSet && i === 3,
      done = i < pdone,
      current = i === pdone;
    const rawLabel = fitNodeLabel(String(isBoss ? peak.boss : peak.topics[i] || "Practice"));
    const label = escapeXml(rawLabel);
    let inner = "";
    if (done) {
      inner = `<circle cx="${p.x}" cy="${p.y}" r="${isBoss ? 13 : 9}" fill="var(--green)"/>
               <circle cx="${p.x}" cy="${p.y}" r="${isBoss ? 13 : 9}" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>
               <path d="M${p.x - 5} ${p.y} l4 4 l7 -8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (current) {
      const halo = `<ellipse class="halo" cx="${p.x}" cy="${p.y + 12}" rx="25" ry="11" fill="var(--yellow-soft)" opacity=".9"/>`;
      if (isBoss) {
        inner =
          halo +
          `<circle cx="${p.x}" cy="${p.y}" r="15" fill="#fff"/><circle cx="${p.x}" cy="${p.y}" r="11.2" fill="var(--yellow)"/>
          <text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="13">😺</text>
          <rect x="${p.x}" y="${p.y - 28}" width="3" height="15" fill="var(--yellow-deep)"/>
          <path d="M${p.x + 3} ${p.y - 28} l13 4.5 l-13 4.5 Z" fill="var(--yellow)"/>`;
      } else {
        inner =
          halo +
          `<circle cx="${p.x}" cy="${p.y}" r="14" fill="#fff"/><circle cx="${p.x}" cy="${p.y}" r="10.2" fill="var(--yellow)"/>
          <g class="climber"><g transform="translate(${p.x},${p.y - 13})">
            <circle cx="0" cy="-3" r="3.6" fill="#fff"/>
            <path d="M-3.3 1 q3.3 -4 6.6 0 l-1 6.5 h-4.6 Z" fill="#fff"/>
            <path d="M-3.6 -5 a3.8 2.1 0 0 1 7.2 0 Z" fill="var(--yellow-deep)"/>
          </g></g>`;
      }
    } else {
      inner = `<circle cx="${p.x}" cy="${p.y}" r="${isBoss ? 9 : 7.5}" fill="#fff"/>
               <circle cx="${p.x}" cy="${p.y}" r="${isBoss ? 6 : 4.8}" fill="var(--node-lock)"/>
               ${isBoss ? `<rect x="${p.x}" y="${p.y - 22}" width="3" height="11" fill="#BBD8CB"/><path d="M${p.x + 3} ${p.y - 22} l9 3 l-9 3 Z" fill="#CDD9D1"/>` : ""}`;
    }
    const w = Math.min(
      NODE_LABEL_MAX_WIDTH,
      Math.max(NODE_LABEL_MIN_WIDTH, labelUnits(rawLabel) * NODE_LABEL_UNIT_PX + NODE_LABEL_PADDING * 2)
    );
    const labelX = Math.min(340 - NODE_LABEL_SCREEN_MARGIN - w / 2, Math.max(NODE_LABEL_SCREEN_MARGIN + w / 2, p.x));
    const ly = p.y - (isBoss ? 27 : 25);
    const lc = current ? "var(--yellow-deep)" : "var(--muted)";
    const lw = current ? "600" : "500";
    const state = done ? "done" : current ? "current" : "lock";
    const lbl = `<rect x="${labelX - w / 2}" y="${ly - 12}" width="${w}" height="17" rx="8.5" fill="#fff" opacity="${current ? 1 : 0.94}"/>
                 <text x="${labelX}" y="${ly}" text-anchor="middle" font-size="10.5" fill="${lc}" font-weight="${lw}">${label}</text>`;
    const node = `<g class="node" data-i="${i}" data-state="${state}">${lbl}${inner}</g>`;
    if (state === "lock" || (isBoss && !isTopicSet)) return node;
    return `<a href="${escapeXml(practiceHref(peak, partIdx, ki, i, partName))}" class="node-link">${node}</a>`;
  }).join("");

  let dots = "";
  for (let d = 0; d < total; d++) {
    const cy = 126 + (total - 1 - d) * 14;
    dots += `<circle cx="18" cy="${cy}" r="${d === ki ? 4.5 : 3}" fill="${d === ki ? "#fff" : "rgba(255,255,255,.5)"}"/>`;
  }
  const entryTrail =
    ki > 0
      ? `<path d="${entryPathD()}" fill="none" stroke="rgba(74,48,24,.16)" stroke-width="17" stroke-linecap="round"/>
    <path d="${entryPathD()}" fill="none" stroke="#A9773E" stroke-width="10" stroke-linecap="round" opacity=".5"/>
    <path d="${entryPathD()}" fill="none" stroke="#D8B071" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1.5 10" opacity=".56"/>`
      : "";
  const nextTrail =
    ki < total - 1
      ? `<path d="${onwardPath}" fill="none" stroke="rgba(74,48,24,.14)" stroke-width="17" stroke-linecap="round"/>
    <path d="${onwardPath}" fill="none" stroke="#A9773E" stroke-width="10" stroke-linecap="round" opacity=".46"/>
    <path d="${onwardPath}" fill="none" stroke="#D8B071" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="1.5 10" opacity=".5"/>`
      : "";

  return `
  <svg class="map" viewBox="0 0 340 720" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="mtMain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#81D7B8"/><stop offset="1" stop-color="#4FBD93"/></linearGradient>
      <linearGradient id="mtFore" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5FC79C"/><stop offset="1" stop-color="#43B083"/></linearGradient>
      <linearGradient id="pathGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B8874A"/><stop offset="1" stop-color="#8B5E31"/></linearGradient>
      <radialGradient id="dawnGlow" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#FFECA8" stop-opacity=".75"/><stop offset=".48" stop-color="#FFD77A" stop-opacity=".28"/><stop offset="1" stop-color="#FFD77A" stop-opacity="0"/></radialGradient>
    </defs>

    <ellipse class="sun-glow" cx="286" cy="92" rx="82" ry="56" fill="url(#dawnGlow)"/>
    <path d="M234 116 Q282 84 334 112" fill="none" stroke="#FFE6A1" stroke-width="2.5" stroke-linecap="round" opacity=".42"/>

    <g class="cloud"><ellipse cx="74" cy="118" rx="34" ry="15" fill="#fff"/><ellipse cx="96" cy="108" rx="22" ry="14" fill="#fff"/><ellipse cx="52" cy="112" rx="18" ry="11" fill="#fff"/><ellipse cx="118" cy="119" rx="16" ry="9" fill="#D7EAF9" opacity=".55"/></g>
    <g class="cloud c2"><ellipse cx="250" cy="176" rx="26" ry="12" fill="#fff" opacity=".92"/><ellipse cx="267" cy="168" rx="17" ry="10" fill="#fff" opacity=".92"/><ellipse cx="228" cy="178" rx="17" ry="8" fill="#D7EAF9" opacity=".52"/></g>

    <g class="bird1"><g class="wing"><path d="M0 0 Q5 -5 10 0 Q15 -5 20 0" fill="none" stroke="#6E8E9E" stroke-width="2" stroke-linecap="round"/></g></g>
    <g class="bird2"><g class="wing"><path d="M0 0 Q4 -4 8 0 Q12 -4 16 0" fill="none" stroke="#7C99A6" stroke-width="1.8" stroke-linecap="round"/></g></g>
    <g class="bird3"><g class="wing"><path d="M0 0 Q4.5 -4.5 9 0 Q13.5 -4.5 18 0" fill="none" stroke="#88A2AE" stroke-width="1.8" stroke-linecap="round"/></g></g>

    <path d="M-34 720 L-28 414 C20 360 72 386 114 340 C160 290 202 306 246 262 C292 216 338 218 398 256 L398 720 Z" fill="#BFE0D6"/>
    <path d="M-26 720 L-18 552 C8 444 54 392 98 346 C136 306 168 326 204 284 C248 234 284 240 322 198 C348 170 370 154 394 142 L394 720 Z" fill="url(#mtMain)"/>
    <path d="M-18 708 C34 656 76 684 130 632 C178 586 222 606 266 560 C310 516 346 524 392 548 L392 720 L-18 720 Z" fill="#68C7A1" opacity=".66"/>
    <path d="M8 628 C52 578 92 602 136 552 C178 506 224 530 268 478 C304 436 344 438 388 468 L388 720 L8 720 Z" fill="#76CBA8" opacity=".44"/>
    <path d="M-8 520 C38 462 76 486 120 438 C164 390 208 412 252 364 C294 320 340 320 390 346 L390 720 L-8 720 Z" fill="#86D5B5" opacity=".28"/>
    <path d="M-22 720 L-14 640 C42 590 92 632 150 596 C204 562 250 590 302 552 C338 526 360 520 382 532 L382 720 Z" fill="url(#mtFore)"/>
    <path d="M36 552 C84 520 122 526 162 492 C202 458 232 468 276 430" fill="none" stroke="#D7EAF9" stroke-width="19" stroke-linecap="round" opacity=".14"/>
    <path d="M58 430 C104 386 148 404 190 358 C226 320 266 326 312 286" fill="none" stroke="#D7EAF9" stroke-width="16" stroke-linecap="round" opacity=".13"/>
    <path d="M84 560 q6 16 -3 27 q-10 -9 3 -27Z" fill="#3FA37D" opacity=".45"/>
    <path d="M300 566 q6 16 -3 27 q-10 -9 3 -27Z" fill="#3FA37D" opacity=".4"/>

    <g><path d="M40 596 l8 -18 l8 18 Z" fill="#3C8F6E"/><path d="M40 587 l8 -16 l8 16 Z" fill="#4CA37E"/><rect x="46" y="596" width="4" height="7" fill="#9B7B53"/></g>
    <g><path d="M286 588 l7 -15 l7 15 Z" fill="#3C8F6E"/><path d="M286 581 l7 -13 l7 13 Z" fill="#4CA37E"/><rect x="290" y="588" width="4" height="7" fill="#9B7B53"/></g>
    <circle cx="150" cy="640" r="3" fill="var(--yellow)" opacity=".9"/><circle cx="210" cy="628" r="3" fill="#fff" opacity=".85"/><circle cx="120" cy="620" r="2.5" fill="var(--blue-soft)"/>

    ${entryTrail}
    <path d="${mainPath}" fill="none" stroke="rgba(74,48,24,.22)" stroke-width="19" stroke-linecap="round"/>
    <path d="${mainPath}" fill="none" stroke="url(#pathGrad)" stroke-width="12" stroke-linecap="round"/>
    <path d="${mainPath}" fill="none" stroke="#D8B071" stroke-width="3" stroke-linecap="round" stroke-dasharray="1.5 11"/>
    ${nextTrail}

    <g><circle cx="${FOOT.x}" cy="${FOOT.y}" r="10" fill="var(--green)"/><path d="M${FOOT.x - 5} ${FOOT.y} l4 4 l7 -8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${nodes}

    <text x="170" y="134" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" style="paint-order:stroke" stroke="rgba(70,130,160,.35)" stroke-width="3">${escapeXml(peak.name)}</text>
    ${dots}
  </svg>`;
}

export default function ClimbingMap({
  parts,
  loaded,
  initialPart = "",
  initialPeak = "",
}: {
  parts: Part[];
  loaded: boolean;
  initialPart?: string;
  initialPeak?: string;
}) {
  const router = useRouter();

  const initialPartIdx = Number(initialPart);
  const initialPeakIdx = Number(initialPeak);
  const [partIdx, setPartIdx] = useState(Number.isFinite(initialPartIdx) ? Math.max(0, Math.min(initialPartIdx, parts.length - 1)) : 1);
  const [peakIdx, setPeakIdx] = useState(
    Number.isFinite(initialPeakIdx)
      ? Math.max(0, Math.min(initialPeakIdx, (parts[Number.isFinite(initialPartIdx) ? Math.max(0, Math.min(initialPartIdx, parts.length - 1)) : 1]?.peaks.length ?? 1) - 1))
      : 0
  );
  const [prog, setProg] = useState<Record<string, number>>({});
  const [target, setTarget] = useState("6.5");

  const [sceneAnim, setSceneAnim] = useState<"" | "exitUp" | "enterDown">("");
  const [mist, setMist] = useState<{ key: number; dir: "up" | "down" } | null>(null);
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [onboard, setOnboard] = useState(false);
  const [persona, setPersona] = useState("");

  const animatingRef = useRef(false);
  const toastHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastShowFrame = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const wheelLockRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    if (toastShowFrame.current) cancelAnimationFrame(toastShowFrame.current);
    if (toastHideTimer.current) clearTimeout(toastHideTimer.current);
    if (toastClearTimer.current) clearTimeout(toastClearTimer.current);
    setToastVisible(false);
    setToast(msg);
    toastShowFrame.current = requestAnimationFrame(() => {
      toastShowFrame.current = requestAnimationFrame(() => setToastVisible(true));
    });
    toastHideTimer.current = setTimeout(() => setToastVisible(false), 1450);
    toastClearTimer.current = setTimeout(() => setToast(""), 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastShowFrame.current) cancelAnimationFrame(toastShowFrame.current);
      if (toastHideTimer.current) clearTimeout(toastHideTimer.current);
      if (toastClearTimer.current) clearTimeout(toastClearTimer.current);
    };
  }, []);

  useEffect(() => {
    if (stageRef.current) stageRef.current.dataset.reactReady = "1";
  }, []);

  const getDone = useCallback(
    (pi: number, ki: number): number => {
      const s = prog[`${pi}-${ki}`];
      return s !== undefined ? s : parts[pi]?.peaks[ki]?.done ?? 0;
    },
    [prog, parts]
  );

  // init: load progress + target + onboarding + handle return-from-card (?done=1)
  useEffect(() => {
    let stored: Record<string, number> = {};
    try {
      stored = JSON.parse(localStorage.getItem(PKEY) || "{}");
    } catch {}
    setTarget(localStorage.getItem("speaker_target") || "6.5");
    setPersona(localStorage.getItem("speaker_persona") || "");

    const u = new URLSearchParams(window.location.search);
    let pi = 1;
    let ki = 0;
    if (u.has("p")) {
      const requestedPart = Number(u.get("p"));
      if (Number.isFinite(requestedPart)) pi = Math.max(0, Math.min(requestedPart, parts.length - 1));
    }
    if (u.has("pk")) {
      const requestedPeak = Number(u.get("pk"));
      if (Number.isFinite(requestedPeak)) ki = Math.max(0, Math.min(requestedPeak, (parts[pi]?.peaks.length ?? 1) - 1));
    }

    if (u.get("done") === "1") {
      const n = Number(u.get("n"));
      const key = `${pi}-${ki}`;
      const cur = stored[key] !== undefined ? stored[key] : parts[pi]?.peaks[ki]?.done ?? 0;
      if (n === cur) {
        stored = { ...stored, [key]: cur + 1 };
        localStorage.setItem(PKEY, JSON.stringify(stored));
      }
      const topic = u.get("topic") ? decodeURIComponent(u.get("topic")!) : "关卡";
      setTimeout(() => showToast(`🎉 ${topic} 点亮成功！+20 经验`), 350);
    }

    setPartIdx(pi);
    setPeakIdx(ki);
    setProg(stored);
    window.history.replaceState({}, "", window.location.pathname);

    if (!loaded) showToast("题库读取失败，已使用内置备用题");
    if (!localStorage.getItem("speaker_onboarded")) setTimeout(() => setOnboard(true), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = parts[partIdx]?.peaks.length ?? 0;
  const peak = parts[partIdx]?.peaks[peakIdx];

  const sceneHtml = useMemo(() => {
    if (!peak) return "";
    return buildScene(peak, getDone(partIdx, peakIdx), peakIdx, total, parts[partIdx]?.name || "", partIdx);
  }, [peak, partIdx, peakIdx, total, getDone, parts]);

  const switchPeak = useCallback(
    (dir: number) => {
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
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setSceneAnim("");
            animatingRef.current = false;
          })
        );
      }, 300);
    },
    [peakIdx, total, showToast]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (wheelLockRef.current || Math.abs(e.deltaY) < 12) return;
      wheelLockRef.current = true;
      switchPeak(e.deltaY < 0 ? +1 : -1);
      setTimeout(() => {
        wheelLockRef.current = false;
      }, 650);
    },
    [switchPeak]
  );

  const switchPart = useCallback(
    (dir: number) => {
      const next = partIdx + dir;
      if (next < 0 || next >= parts.length) {
        showToast(dir > 0 ? "已经是最后一个 Part" : "已经是第一个 Part");
        return;
      }
      setPartIdx(next);
      setPeakIdx(0);
    },
    [partIdx, parts.length, showToast]
  );

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    dragStart.current = { x: clientX, y: clientY };
  }, []);

  const handleDragEnd = useCallback(
    (clientX: number, clientY: number) => {
      if (dragStart.current === null) return;
      const dx = clientX - dragStart.current.x;
      const dy = clientY - dragStart.current.y;
      dragStart.current = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) switchPart(dx < 0 ? +1 : -1);
      else if (Math.abs(dy) > 55) switchPeak(dy > 0 ? +1 : -1);
    },
    [switchPart, switchPeak]
  );

  const onSceneClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const nodeEl = (e.target as Element).closest(".node") as HTMLElement | null;
      if (!nodeEl || !peak) return;
      const i = Number(nodeEl.dataset.i);
      const st = nodeEl.dataset.state;
      if (st === "lock") {
        nodeEl.classList.add("shake");
        setTimeout(() => nodeEl.classList.remove("shake"), 450);
        showToast(i === 3 ? "🔒 先清完本峰 3 关再战 Boss" : "🔒 先过前面的关卡");
        return;
      }
      if (parts[partIdx].name !== "Part 1" && parts[partIdx].name !== "Part 2&3" && parts[partIdx].name !== "Part 2串题" && i === 3) {
        showToast("😺 考官 Boss 即将上线");
        return;
      }
      const partName = parts[partIdx].name;
      const partNo = partName === "Part 1" ? 1 : partName === "Part 3" ? 3 : partName === "Part 2串题" ? 4 : 2;
      const card = peak.cards[i];
      const question = card?.questions?.find((q) => q.part === partNo) || card?.questions?.[0];
      const label = peak.topics[i] || "Practice";
      const qs =
        `?p=${partIdx}&pk=${peakIdx}&n=${i}` +
        `&part=${encodeURIComponent(partName)}` +
        `&topic=${encodeURIComponent(label)}` +
        (card ? `&topicId=${encodeURIComponent(card.id)}` : "") +
        (question ? `&questionId=${encodeURIComponent(question.id)}` : "");
      router.push(`/practice${qs}`);
    },
    [peak, parts, partIdx, peakIdx, router, showToast]
  );

  function finishOnboard() {
    const v = persona.trim();
    if (v) localStorage.setItem("speaker_persona", v);
    localStorage.setItem("speaker_onboarded", "1");
    setOnboard(false);
  }

  return (
    <div className={styles.frame}>
      <div className={styles.phone} style={{ background: SKIES[Math.min(peakIdx, SKIES.length - 1)] }}>
        <div
          className={styles.stage}
          ref={stageRef}
          data-map-stage="true"
          data-part-idx={partIdx}
          data-part-count={parts.length}
          data-peak-idx={peakIdx}
          data-total-peaks={total}
          onWheel={handleWheel}
          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
          onMouseUp={(e) => handleDragEnd(e.clientX, e.clientY)}
          onMouseLeave={() => {
            dragStart.current = null;
          }}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={(e) => handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
          onTouchCancel={() => {
            dragStart.current = null;
          }}
        >
          <div
            className={`${styles.scene} ${sceneAnim ? styles[sceneAnim] : ""}`}
            onClick={onSceneClick}
            dangerouslySetInnerHTML={{ __html: sceneHtml }}
          />
          {mist ? (
            <div key={mist.key} className={`${styles.mist} ${mist.dir === "up" ? styles.up : styles.down}`}>
              <svg viewBox="0 0 340 240" preserveAspectRatio="none" width="100%" height="100%">
                <ellipse cx="60" cy="80" rx="80" ry="36" fill="#fff" opacity=".92" />
                <ellipse cx="180" cy="56" rx="95" ry="42" fill="#fff" opacity=".96" />
                <ellipse cx="300" cy="92" rx="85" ry="38" fill="#fff" opacity=".92" />
                <ellipse cx="120" cy="140" rx="100" ry="44" fill="#fff" opacity=".88" />
                <ellipse cx="250" cy="150" rx="90" ry="40" fill="#fff" opacity=".9" />
              </svg>
            </div>
          ) : null}
        </div>

        <div className={styles.hud}>
          <div className={styles.hudMain}>
            <div className={styles.parts}>
              {parts.map((p, idx) => (
                <a
                  key={p.name}
                  href={`/map?p=${idx}&pk=0`}
                  className={`${styles.part} ${idx === partIdx ? styles.active : ""}`}
                >
                  <span className={styles.partPrefix}>P</span>
                  <span>{displayPartName(p.name)}</span>
                </a>
              ))}
            </div>
            <div className={styles.metrics}>
              <div className={styles.metric}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="12" cy="12" r="1" />
                </svg>
                Target <span>{target}</span>
              </div>
              <div className={styles.metric}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 20h18" />
                  <path d="M6 20l6-15 6 15" />
                  <path d="M9 13h6" />
                </svg>
                <span>{ALT[Math.min(peakIdx, ALT.length - 1)].toLocaleString()}</span>m
              </div>
            </div>
          </div>
          <div className={styles.hudActions}>
            <div className={styles.spark}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.2c2.6 2.9 2.2 5.2 4.1 7 2.2 2 4 4.2 4 7a7.9 7.9 0 0 1-15.8 0c0-3 1.5-5.4 3.7-7.3 1.5-1.3 2-3.7 4-6.7Z" fill="#E64B3C" />
                <path d="M12.7 13.1c.8 1.2 2.4 2.2 2.4 4.2a3.2 3.2 0 0 1-6.4 0c0-1.7 1.1-2.8 2.2-4 .1 1 .7 1.5 1.3 1.5.5 0 .8-.5.5-1.7Z" fill="#FFB238" />
              </svg>
              <span>7</span>
            </div>
            <a className={styles.settings} aria-label="设置" href="/profile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 0 1-4 0v-.06a1.7 1.7 0 0 0-1-.54 1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 0 1 0-4h.06a1.7 1.7 0 0 0 .54-1 1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 0 1 4 0v.06a1.7 1.7 0 0 0 1 .54 1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.2.36.4.68.6 1H20a2 2 0 0 1 0 4h-.06a1.7 1.7 0 0 0-.54 1Z" />
              </svg>
            </a>
          </div>
        </div>

        {peakIdx < total - 1 ? (
          <div className={styles.hint}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        ) : null}

        <div className={styles.bottom}>
          <div className={styles.review} onClick={() => showToast("🎁 今日复习补给 · +20 经验")}>
            <div className={styles.ic}>🎁</div>
            <div>
              <div className={styles.t1}>Daily review</div>
              <div className={styles.t2}>点亮 +20 经验 · 1 关</div>
            </div>
            <div className={styles.arr}>›</div>
          </div>
        </div>

        {toast ? <div className={`${styles.toast} ${toastVisible ? styles.show : ""}`}>{toast}</div> : null}

        {onboard ? <div className={`${styles.onboard} ${styles.show}`}>
          <div className={styles.obCard}>
            <div className={styles.em}>👋</div>
            <h2>先告诉我你是谁</h2>
            <p>写一句你的身份和爱好，AI 会据此生成更像「你」的口语范本。之后随时能在「我的」里修改。</p>
            <textarea
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="例：我是一名爱爬山和摄影的大三学生，养了只猫，周末喜欢逛独立咖啡馆。"
            />
            <button className={styles.obGo} onClick={finishOnboard}>
              开始攀登
            </button>
            <button className={styles.obSkip} onClick={finishOnboard}>
              先跳过，稍后再填
            </button>
          </div>
        </div> : null}
      </div>
    </div>
  );
}
