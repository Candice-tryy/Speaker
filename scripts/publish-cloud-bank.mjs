import { promises as fs } from "node:fs";
import path from "node:path";
import cloudbase from "@cloudbase/node-sdk";

const ROOT = process.cwd();
const ENV_FILES = [".env.local", ".env"];
const OUT_DIR = path.join(ROOT, "dist", "cloud-bank");
const MANIFEST_PATH = path.join(OUT_DIR, "bank_manifest.active.json");
const PARTS_PATH = path.join(OUT_DIR, "bank_parts.json");
const MANIFEST_COLLECTION = "bank_manifest";
const PARTS_COLLECTION = "bank_parts";

async function loadEnvFiles() {
  for (const file of ENV_FILES) {
    const fullPath = path.join(ROOT, file);
    let source = "";
    try {
      source = await fs.readFile(fullPath, "utf8");
    } catch {
      continue;
    }
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonLines(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local or set it in your shell.`);
  }
  return value;
}

function withoutId(doc) {
  const { _id, ...rest } = doc;
  return rest;
}

async function ensureCollection(db, name) {
  try {
    await Promise.resolve(db.createCollection(name));
  } catch (error) {
    const message = String(error?.message || error);
    if (!/exist|already|duplicate|collection/i.test(message)) {
      console.warn(`Could not create collection ${name}; continuing in case it already exists.`);
    }
  }
}

async function setDoc(db, collectionName, doc) {
  await db.collection(collectionName).doc(doc._id).set(withoutId(doc));
}

async function main() {
  await loadEnvFiles();

  const env = requireEnv("CLOUD_ENV_ID");
  const secretId = requireEnv("TENCENTCLOUD_SECRETID");
  const secretKey = requireEnv("TENCENTCLOUD_SECRETKEY");

  const manifest = await readJson(MANIFEST_PATH);
  const partDocs = await readJsonLines(PARTS_PATH);

  if (!manifest?._id || !manifest?.activeVersion) {
    throw new Error(`Invalid manifest: ${MANIFEST_PATH}`);
  }
  if (!partDocs.length || partDocs.some((doc) => !doc._id || !doc.version || !doc.name || !doc.part)) {
    throw new Error(`Invalid part docs: ${PARTS_PATH}`);
  }

  const app = cloudbase.init({ env, secretId, secretKey });
  const db = app.database();

  await ensureCollection(db, MANIFEST_COLLECTION);
  await ensureCollection(db, PARTS_COLLECTION);

  console.log(`Publishing bank version ${manifest.activeVersion} to ${env}...`);

  for (const doc of partDocs) {
    await setDoc(db, PARTS_COLLECTION, doc);
    const topics = doc.part.peaks.reduce((sum, peak) => sum + peak.cards.length, 0);
    const questions = doc.part.peaks.reduce(
      (sum, peak) => sum + peak.cards.reduce((peakSum, topic) => peakSum + topic.questions.length, 0),
      0
    );
    console.log(`Uploaded ${doc.name}: ${topics} topics, ${questions} questions`);
  }

  await setDoc(db, MANIFEST_COLLECTION, {
    ...manifest,
    uploadedAt: new Date().toISOString(),
  });

  console.log(`Activated version ${manifest.activeVersion}.`);
}

main().catch((error) => {
  console.error(error?.message || error);
  console.error("");
  console.error("Required one-time setup:");
  console.error("1. Create/enable a WeChat CloudBase environment for this mini program.");
  console.error("2. Add CLOUD_ENV_ID, TENCENTCLOUD_SECRETID, and TENCENTCLOUD_SECRETKEY to .env.local.");
  console.error("3. Run: npm.cmd run bank:publish");
  process.exitCode = 1;
});
