// The exact stroke icons the web version renders inline (CardPractice.tsx,
// ClimbingMap.tsx, profile/page.tsx), exported as SVG data URLs for <Image>.
// currentColor is resolved to the literal color each button uses on the web.
import { svgToDataUrl } from "./scene";

const GREEN_DEEP = "#2e9c97";
const BLUE_DEEP = "#3585c2";

function stroke(body: string, color: string, width = 2): string {
  return svgToDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  );
}

const GEAR_BODY =
  `<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/>` +
  `<path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 0 1-4 0v-.06a1.7 1.7 0 0 0-1-.54 1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 0 1 0-4h.06a1.7 1.7 0 0 0 .54-1 1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 0 1 4 0v.06a1.7 1.7 0 0 0 1 .54 1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.2.36.4.68.6 1H20a2 2 0 0 1 0 4h-.06a1.7 1.7 0 0 0-.54 1Z"/>`;

export const ICONS = {
  back: stroke(`<path d="M15 18l-6-6 6-6"/>`, GREEN_DEEP, 2.2),
  list: stroke(
    `<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>`,
    BLUE_DEEP,
    2.1
  ),
  flag: stroke(`<path d="M5 21V5a1 1 0 0 1 1-1h11l-2 4 2 4H6"/>`, "#FF9466", 2),
  gearBlue: stroke(GEAR_BODY, BLUE_DEEP, 2.1),
  chevronDown: stroke(`<path d="M6 9l6 6 6-6"/>`, GREEN_DEEP, 2.2),
  speaker: stroke(`<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/>`, GREEN_DEEP, 2),
  pencil: stroke(`<path d="M12 19l7-7-3-3-7 7v3z"/><path d="M16 9l3-3-2-2-3 3"/>`, GREEN_DEEP, 2),
  mic: stroke(
    `<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/>`,
    "#7a5200",
    2
  ),
  bulb: stroke(
    `<path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4 12c-.7.7-1 1.3-1 2H9c0-.7-.3-1.3-1-2A7 7 0 0 1 12 2z"/>`,
    "#c75a2c",
    2
  ),
  play: stroke(`<path d="M8 5v14l11-7z"/>`, GREEN_DEEP, 2),
  mountain: stroke(`<path d="M3 21l6-12 5 7 3-4 4 9z"/>`, BLUE_DEEP, 2.1),
  cardDoc: stroke(
    `<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h3"/>`,
    BLUE_DEEP,
    2.1
  ),
  targetWhite: stroke(`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>`, "#fff", 2),
  altWhite: stroke(`<path d="M3 20h18"/><path d="M6 20l6-15 6 15"/><path d="M9 13h6"/>`, "#fff", 2.2),
  spark: svgToDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
      `<path d="M12 2.2c2.6 2.9 2.2 5.2 4.1 7 2.2 2 4 4.2 4 7a7.9 7.9 0 0 1-15.8 0c0-3 1.5-5.4 3.7-7.3 1.5-1.3 2-3.7 4-6.7Z" fill="#E64B3C"/>` +
      `<path d="M12.7 13.1c.8 1.2 2.4 2.2 2.4 4.2a3.2 3.2 0 0 1-6.4 0c0-1.7 1.1-2.8 2.2-4 .1 1 .7 1.5 1.3 1.5.5 0 .8-.5.5-1.7Z" fill="#FFB238"/>` +
      `</svg>`
  ),
  chevronDownWhite: stroke(`<path d="M6 9l6 6 6-6"/>`, "#fff", 2.4),
  chevronUpWhite: stroke(`<path d="M6 15l6-6 6 6"/>`, "#fff", 2.4),
  book: stroke(`<path d="M4 4h13a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z"/><path d="M8 4v16"/>`, GREEN_DEEP, 2),
  bell: stroke(
    `<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>`,
    GREEN_DEEP,
    2
  ),
};

// The peak-switch mist overlay, identical to the web inline SVG
// (ClimbingMap.tsx), stretched to fill via mode="scaleToFill".
export const MIST = svgToDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="240" viewBox="0 0 340 240" preserveAspectRatio="none">` +
    `<ellipse cx="60" cy="80" rx="80" ry="36" fill="#fff" opacity=".92"/>` +
    `<ellipse cx="180" cy="56" rx="95" ry="42" fill="#fff" opacity=".96"/>` +
    `<ellipse cx="300" cy="92" rx="85" ry="38" fill="#fff" opacity=".92"/>` +
    `<ellipse cx="120" cy="140" rx="100" ry="44" fill="#fff" opacity=".88"/>` +
    `<ellipse cx="250" cy="150" rx="90" ry="40" fill="#fff" opacity=".9"/>` +
    `</svg>`
);

// The profile trend chart, identical to the web polyline (stretched like
// preserveAspectRatio="none" via mode="scaleToFill").
export const TREND_CHART = svgToDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="56" viewBox="0 0 280 56" preserveAspectRatio="none">` +
    `<polyline fill="none" stroke="#3FC196" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="6,44 52,40 98,34 144,36 190,26 236,18 274,14"/>` +
    `<circle cx="274" cy="14" r="4.5" fill="#5DAEE6"/>` +
    `</svg>`
);
