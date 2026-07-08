// Loading-screen art, ported verbatim from preview/loading-sun.html so the
// mini program matches the prototype pixel for pixel. Shapes CSS views can
// only approximate (ellipse clouds, the quadratic smile, ray capsules) stay
// as SVG rendered via <Image src={data url}> — real devices render SVG
// base64 data URLs fine (same approach as the map scene). Animations
// (drift/bob/breathe/spin) live on wrappers in the page scss.
import { svgToDataUrl } from "./scene";

const svg = (attrs: string, body: string) =>
  svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`);

// 8 ray capsules around (100,100); the spin animation rotates the whole image.
export const LOADING_SUN_RAYS = svg(
  'viewBox="0 0 200 200" fill="#FBC24A"',
  [0, 45, 90, 135, 180, 225, 270, 315]
    .map(
      (deg) =>
        `<rect x="94.5" y="32" width="11" height="20" rx="5.5"${deg ? ` transform="rotate(${deg} 100 100)"` : ""}/>`
    )
    .join("")
);

// Face at full viewBox size; the prototype's scale(.833) is applied via CSS
// on the <Image> so the rays/face size ratio stays identical.
export const LOADING_SUN_FACE = svg(
  'viewBox="0 0 200 200" fill="none"',
  `<defs><radialGradient id="sunFill" cx="42%" cy="38%" r="70%">` +
    `<stop offset="0%" stop-color="#FFD25E"/>` +
    `<stop offset="70%" stop-color="#FBB63B"/>` +
    `<stop offset="100%" stop-color="#F6A52E"/>` +
    `</radialGradient></defs>` +
    `<circle cx="100" cy="100" r="49" fill="url(#sunFill)"/>` +
    `<circle cx="100" cy="100" r="49" fill="none" stroke="#F4A02B" stroke-opacity=".35" stroke-width="3"/>` +
    `<ellipse cx="79" cy="109" rx="8" ry="5.5" fill="#FF9C6E" opacity=".55"/>` +
    `<ellipse cx="121" cy="109" rx="8" ry="5.5" fill="#FF9C6E" opacity=".55"/>` +
    `<circle cx="85" cy="94" r="6" fill="#5A3B17"/>` +
    `<circle cx="115" cy="94" r="6" fill="#5A3B17"/>` +
    `<circle cx="87" cy="92" r="1.9" fill="#fff"/>` +
    `<circle cx="117" cy="92" r="1.9" fill="#fff"/>` +
    `<path d="M85 110 Q100 126 115 110" stroke="#5A3B17" stroke-width="5.5" stroke-linecap="round" fill="none"/>`
);

// Clouds cropped to their bounding boxes; the page scss positions them at the
// same 340×720 design coordinates the prototype's cloud layer uses. Cloud
// three reuses cloud one's art (the prototype translates the same group).
export const LOADING_CLOUD_BIG = svg(
  'viewBox="34 94 100 39"',
  `<ellipse cx="74" cy="118" rx="34" ry="15" fill="#fff"/>` +
    `<ellipse cx="96" cy="108" rx="22" ry="14" fill="#fff"/>` +
    `<ellipse cx="52" cy="112" rx="18" ry="11" fill="#fff"/>` +
    `<ellipse cx="118" cy="119" rx="16" ry="9" fill="#D7EAF9" opacity=".55"/>`
);

export const LOADING_CLOUD_SMALL = svg(
  'viewBox="211 158 73 30"',
  `<ellipse cx="250" cy="176" rx="26" ry="12" fill="#fff" opacity=".92"/>` +
    `<ellipse cx="267" cy="168" rx="17" ry="10" fill="#fff" opacity=".92"/>` +
    `<ellipse cx="228" cy="178" rx="17" ry="8" fill="#D7EAF9" opacity=".52"/>`
);
