// 1:1 port of the web climbing-map scene (app/map/ClimbingMap.tsx buildScene).
// CSS variables from app/globals.css are inlined as literal colors; scene
// animations (clouds, birds, halo) are static. This module is dependency-free
// on purpose: the mini program uses it for node hit-zone geometry, and the
// Next.js backend imports it in /api/scene to rasterize the SVG to PNG
// (real-device <image> does not reliably render SVG data URLs).

// Structural subset of the bank's Peak — matches both the web lib/types.ts
// Peak and the mini program api.ts Peak.
export interface ScenePeak {
  name: string;
  topics: string[];
  boss: string;
  cards: unknown[];
}

const GREEN = "#3fc196";
const YELLOW = "#f6c84f";
const YELLOW_DEEP = "#c98d16";
const YELLOW_SOFT = "#fff3c8";
const BLUE_SOFT = "#d7eaf9";
const MUTED = "#7c9a8d";
const NODE_LOCK = "#bbd8cb";

export const FOOT = { x: 34, y: 612 };
export const SCENE_W = 340;
export const SCENE_H = 720;

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
const NODE_LABEL_PADDING = 9;
const NODE_LABEL_UNIT_PX = 10.4;
const NODE_LABEL_MIN_WIDTH = 46;
const NODE_LABEL_MAX_WIDTH = 142;
const NODE_LABEL_SCREEN_MARGIN = 10;
const NODE_LABEL_MAX_UNITS = (NODE_LABEL_MAX_WIDTH - NODE_LABEL_PADDING * 2) / NODE_LABEL_UNIT_PX;

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

export type NodeState = "done" | "current" | "lock";

export interface SceneNode {
  i: number;
  x: number;
  y: number;
  state: NodeState;
  isBoss: boolean;
}

export interface Scene {
  svg: string;
  nodes: SceneNode[];
}

export function buildScene(peak: ScenePeak, pdone: number, ki: number, total: number, partName: string): Scene {
  const isTopicSet = partName === "Part 1" || partName === "Part 2&3" || partName === "Part 2串题";
  const isCombo = partName === "Part 2串题";
  const nodePos = isCombo ? comboRoutePositions(peak.cards.length, ki) : isTopicSet ? part1RoutePositions(peak.cards.length, ki) : STANDARD_NODE_POS;
  const mainPath = isTopicSet ? (isCombo ? routePath(nodePos) : part1PathD(nodePos, ki)) : routePath(nodePos);
  const onwardPath = isTopicSet
    ? `M${nodePos[nodePos.length - 1]?.x || 220} ${nodePos[nodePos.length - 1]?.y || 320} C258 302 306 318 340 286`
    : nextPathD();
  const nodeData: SceneNode[] = [];
  const nodes = nodePos.map((p, i) => {
    const isBoss = !isTopicSet && i === 3,
      done = i < pdone,
      current = i === pdone;
    nodeData.push({ i, x: p.x, y: p.y, state: done ? "done" : current ? "current" : "lock", isBoss });
    const rawLabel = fitNodeLabel(String(isBoss ? peak.boss : peak.topics[i] || "Practice"));
    const label = escapeXml(rawLabel);
    let inner = "";
    if (done) {
      inner = `<circle cx="${p.x}" cy="${p.y}" r="${isBoss ? 13 : 9}" fill="${GREEN}"/>
               <circle cx="${p.x}" cy="${p.y}" r="${isBoss ? 13 : 9}" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>
               <path d="M${p.x - 5} ${p.y} l4 4 l7 -8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (current) {
      const halo = `<ellipse cx="${p.x}" cy="${p.y + 12}" rx="25" ry="11" fill="${YELLOW_SOFT}" opacity=".9"/>`;
      if (isBoss) {
        inner =
          halo +
          `<circle cx="${p.x}" cy="${p.y}" r="15" fill="#fff"/><circle cx="${p.x}" cy="${p.y}" r="11.2" fill="${YELLOW}"/>
          <text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="13">😺</text>
          <rect x="${p.x}" y="${p.y - 28}" width="3" height="15" fill="${YELLOW_DEEP}"/>
          <path d="M${p.x + 3} ${p.y - 28} l13 4.5 l-13 4.5 Z" fill="${YELLOW}"/>`;
      } else {
        inner =
          halo +
          `<circle cx="${p.x}" cy="${p.y}" r="14" fill="#fff"/><circle cx="${p.x}" cy="${p.y}" r="10.2" fill="${YELLOW}"/>
          <g transform="translate(${p.x},${p.y - 13})">
            <circle cx="0" cy="-3" r="3.6" fill="#fff"/>
            <path d="M-3.3 1 q3.3 -4 6.6 0 l-1 6.5 h-4.6 Z" fill="#fff"/>
            <path d="M-3.6 -5 a3.8 2.1 0 0 1 7.2 0 Z" fill="${YELLOW_DEEP}"/>
          </g>`;
      }
    } else {
      inner = `<circle cx="${p.x}" cy="${p.y}" r="${isBoss ? 9 : 7.5}" fill="#fff"/>
               <circle cx="${p.x}" cy="${p.y}" r="${isBoss ? 6 : 4.8}" fill="${NODE_LOCK}"/>
               ${isBoss ? `<rect x="${p.x}" y="${p.y - 22}" width="3" height="11" fill="#BBD8CB"/><path d="M${p.x + 3} ${p.y - 22} l9 3 l-9 3 Z" fill="#CDD9D1"/>` : ""}`;
    }
    const w = Math.min(
      NODE_LABEL_MAX_WIDTH,
      Math.max(NODE_LABEL_MIN_WIDTH, labelUnits(rawLabel) * NODE_LABEL_UNIT_PX + NODE_LABEL_PADDING * 2)
    );
    const labelX = Math.min(340 - NODE_LABEL_SCREEN_MARGIN - w / 2, Math.max(NODE_LABEL_SCREEN_MARGIN + w / 2, p.x));
    const ly = p.y - (isBoss ? 27 : 25);
    const lc = current ? YELLOW_DEEP : MUTED;
    const lw = current ? "600" : "500";
    const lbl = `<rect x="${labelX - w / 2}" y="${ly - 12}" width="${w}" height="17" rx="8.5" fill="#fff" opacity="${current ? 1 : 0.94}"/>
                 <text x="${labelX}" y="${ly}" text-anchor="middle" font-size="10.5" fill="${lc}" font-weight="${lw}">${label}</text>`;
    return `<g>${lbl}${inner}</g>`;
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

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="340" height="720" viewBox="0 0 340 720" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="mtMain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#81D7B8"/><stop offset="1" stop-color="#4FBD93"/></linearGradient>
      <linearGradient id="mtFore" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5FC79C"/><stop offset="1" stop-color="#43B083"/></linearGradient>
      <linearGradient id="pathGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B8874A"/><stop offset="1" stop-color="#8B5E31"/></linearGradient>
      <radialGradient id="dawnGlow" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#FFECA8" stop-opacity=".75"/><stop offset=".48" stop-color="#FFD77A" stop-opacity=".28"/><stop offset="1" stop-color="#FFD77A" stop-opacity="0"/></radialGradient>
    </defs>

    <ellipse cx="286" cy="92" rx="82" ry="56" fill="url(#dawnGlow)"/>
    <path d="M234 116 Q282 84 334 112" fill="none" stroke="#FFE6A1" stroke-width="2.5" stroke-linecap="round" opacity=".42"/>

    <g><ellipse cx="74" cy="118" rx="34" ry="15" fill="#fff"/><ellipse cx="96" cy="108" rx="22" ry="14" fill="#fff"/><ellipse cx="52" cy="112" rx="18" ry="11" fill="#fff"/><ellipse cx="118" cy="119" rx="16" ry="9" fill="#D7EAF9" opacity=".55"/></g>
    <g><ellipse cx="250" cy="176" rx="26" ry="12" fill="#fff" opacity=".92"/><ellipse cx="267" cy="168" rx="17" ry="10" fill="#fff" opacity=".92"/><ellipse cx="228" cy="178" rx="17" ry="8" fill="#D7EAF9" opacity=".52"/></g>

    <g transform="translate(96,206)"><path d="M0 0 Q5 -5 10 0 Q15 -5 20 0" fill="none" stroke="#6E8E9E" stroke-width="2" stroke-linecap="round"/></g>
    <g transform="translate(216,150)"><path d="M0 0 Q4 -4 8 0 Q12 -4 16 0" fill="none" stroke="#7C99A6" stroke-width="1.8" stroke-linecap="round"/></g>
    <g transform="translate(160,178)"><path d="M0 0 Q4.5 -4.5 9 0 Q13.5 -4.5 18 0" fill="none" stroke="#88A2AE" stroke-width="1.8" stroke-linecap="round"/></g>

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
    <circle cx="150" cy="640" r="3" fill="${YELLOW}" opacity=".9"/><circle cx="210" cy="628" r="3" fill="#fff" opacity=".85"/><circle cx="120" cy="620" r="2.5" fill="${BLUE_SOFT}"/>

    ${entryTrail}
    <path d="${mainPath}" fill="none" stroke="rgba(74,48,24,.22)" stroke-width="19" stroke-linecap="round"/>
    <path d="${mainPath}" fill="none" stroke="url(#pathGrad)" stroke-width="12" stroke-linecap="round"/>
    <path d="${mainPath}" fill="none" stroke="#D8B071" stroke-width="3" stroke-linecap="round" stroke-dasharray="1.5 11"/>
    ${nextTrail}

    <g><circle cx="${FOOT.x}" cy="${FOOT.y}" r="10" fill="${GREEN}"/><path d="M${FOOT.x - 5} ${FOOT.y} l4 4 l7 -8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${nodes}

    <text x="170" y="160" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" style="paint-order:stroke" stroke="rgba(70,130,160,.35)" stroke-width="3">${escapeXml(peak.name)}</text>
    ${dots}
  </svg>`;

  return { svg, nodes: nodeData };
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function utf8ToBase64(str: string): string {
  const bytes: number[] = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64[b2 & 63];
  }
  return out;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${utf8ToBase64(svg)}`;
}
