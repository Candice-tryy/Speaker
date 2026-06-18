// Renders the brand icon SVG into the PNG sizes a PWA / iOS home screen needs.
// Run: node scripts/make-icons.mjs   (sharp ships with Next.js)
import sharp from "sharp";
import { writeFile } from "fs/promises";
import path from "path";

const pub = path.join(process.cwd(), "public");

// On-brand: blue sky, white cloud, green mountain with a snow cap + flag.
// Drawn on a 512 canvas; rounded corners are applied by iOS itself, so the
// art bleeds to the edges (maskable-friendly) with a safe central subject.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8FD3FF"/>
      <stop offset="1" stop-color="#D9F0FF"/>
    </linearGradient>
    <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#54CCA0"/>
      <stop offset="1" stop-color="#2E9C97"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="392" cy="120" r="44" fill="#FFF3B0" opacity="0.95"/>
  <g fill="#FFFFFF" opacity="0.95">
    <ellipse cx="120" cy="150" rx="52" ry="30"/>
    <ellipse cx="160" cy="160" rx="44" ry="26"/>
    <ellipse cx="92" cy="165" rx="34" ry="22"/>
  </g>
  <path d="M0 380 L150 210 L250 320 L330 230 L512 410 L512 512 L0 512 Z" fill="url(#mtn)"/>
  <path d="M330 230 L300 268 L330 286 L364 252 Z" fill="#FFFFFF"/>
  <path d="M150 210 L126 240 L150 256 L178 226 Z" fill="#FFFFFF"/>
  <rect x="328" y="190" width="6" height="44" rx="3" fill="#1E7A66"/>
  <path d="M334 192 L372 204 L334 218 Z" fill="#EC7CA8"/>
</svg>`;

await writeFile(path.join(pub, "icon.svg"), svg);

const targets = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
];

for (const [name, size] of targets) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(pub, name));
  console.log("wrote", name, size);
}
