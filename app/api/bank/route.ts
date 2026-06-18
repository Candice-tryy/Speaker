import { NextResponse } from "next/server";
import { load } from "@/lib/question-bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves the question bank to the WeChat mini program (which can't read the
// Resource/ files via fs). Returns the part/peak/card tree the climbing map
// and practice flow need. The Bank's Map indexes are dropped — the client
// rebuilds lookups from `parts`.
export async function GET(): Promise<NextResponse> {
  const bank = await load();
  return NextResponse.json(
    { parts: bank.parts, loaded: bank.loaded },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
