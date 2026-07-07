import { NextResponse } from "next/server";
import sharp from "sharp";
import { load } from "@/lib/question-bank";
import { buildScene } from "@/miniprogram/src/lib/scene";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rasterizes the climbing-map scene for the WeChat mini program. Real-device
// <image> does not reliably render SVG data URLs, so the exact SVG markup the
// web map injects (miniprogram/src/lib/scene.ts is a verified 1:1 port of
// ClimbingMap.tsx buildScene) is rendered to PNG here at 3x for retina.
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const partName = url.searchParams.get("part") || "Part 2&3";
  const bank = await load();
  const part = bank.parts.find((p) => p.name === partName) || bank.parts[0];
  const total = part?.peaks.length ?? 0;
  if (!part || total === 0) return new NextResponse("no bank", { status: 404 });
  const ki = Math.max(0, Math.min(Number(url.searchParams.get("peak")) || 0, total - 1));
  const peak = part.peaks[ki];
  const done = Math.max(0, Number(url.searchParams.get("done")) || 0);
  const { svg } = buildScene(peak, done, ki, total, part.name);
  const png = await sharp(Buffer.from(svg), { density: 216 }).png().toBuffer();
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300",
    },
  });
}
