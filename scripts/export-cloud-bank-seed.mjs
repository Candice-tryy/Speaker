import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "dist", "cloud-bank");
const GENERATED = path.join(ROOT, "miniprogram", "src", "lib", "question-bank.generated.ts");

function extractGeneratedParts(source) {
  const marker = "export const GENERATED_PARTS: Part[] = ";
  const start = source.indexOf(marker);
  if (start === -1) throw new Error("GENERATED_PARTS not found. Run scripts/generate-miniprogram-bank.mjs first.");
  return JSON.parse(source.slice(start + marker.length).replace(/;\s*$/, ""));
}

function partDoc(version, part, index) {
  return {
    _id: `${version}_${index + 1}`,
    version,
    name: part.name,
    order: index + 1,
    part,
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  const version = process.env.BANK_VERSION || new Date().toISOString().slice(0, 10);
  const source = await fs.readFile(GENERATED, "utf8");
  const parts = extractGeneratedParts(source);
  const manifest = {
    _id: "active",
    activeVersion: version,
    parts: parts.map((part) => part.name),
    updatedAt: new Date().toISOString(),
  };
  const partDocs = parts.map((part, index) => partDoc(version, part, index));
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, "bank_manifest.active.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(OUT_DIR, "bank_parts.json"), `${partDocs.map((doc) => JSON.stringify(doc)).join("\n")}\n`, "utf8");
  await fs.writeFile(
    path.join(OUT_DIR, "README.md"),
    [
      "# Cloud Bank Seed",
      "",
      "Import these files into WeChat Cloud Database:",
      "",
      "- `bank_manifest.active.json` -> collection `bank_manifest`, document id `active`",
      "- `bank_parts.json` -> collection `bank_parts`, JSON Lines format",
      "",
      `Version: ${version}`,
      `Parts: ${parts.map((part) => part.name).join(", ")}`,
      "",
    ].join("\n"),
    "utf8"
  );
  console.table(partDocs.map((doc) => ({
    collection: "bank_parts",
    id: doc._id,
    name: doc.name,
    topics: doc.part.peaks.reduce((sum, peak) => sum + peak.cards.length, 0),
    questions: doc.part.peaks.reduce((sum, peak) => sum + peak.cards.reduce((peakSum, topic) => peakSum + topic.questions.length, 0), 0),
  })));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
