# Speaker Project Structure

Updated: 2026-07-07

This repo has three active surfaces:

- `app/` + `lib/` + `Resource/`: Next.js Web/PWA and local API routes.
- `preview/`: static HTML prototype for fast visual/product checks.
- `miniprogram/`: Taro WeChat mini program.

## Documentation Map

Each topic has exactly one authoritative doc; other docs link to it instead of copying:

- `PROJECT_STRUCTURE.md` (this file): repo layout, data layering, question-bank publish workflow, cloud collections.
- `speaking_spec.md`: product intent and design spec. No ops content.
- `miniprogram/README.md`: mini-program-only details (import dir, build commands, bundle-size policy).
- `docs/archive/`: dated historical snapshots, not maintained.

## Current Data Rule

Question-bank storage is split into two layers:

- `archive`: complete historical/source bank, kept for maintenance and future regeneration.
- `current`: active visible bank, used by app surfaces.

Application surfaces must display only current visible questions and matching answers.
Questions with `is_show === 0` are filtered out before they reach user-facing screens.

```text
Resource archive files
-> maintenance only

Resource current files
-> Web/PWA
-> static preview
-> generated mini-program JSON fallback
-> cloud database seed
```

The canonical daily update command is:

```bash
npm.cmd run bank:publish
```

That command refreshes the source files, regenerates LLM sample answers and fallback files, uploads the cloud seed, and finally activates the new cloud version.

## Web/PWA

Main files:

- `app/`
- `lib/question-bank.ts`
- `app/api/bank/route.ts`
- `app/api/score/route.ts`
- `Resource/`

Run:

```bash
npm.cmd run dev
npm.cmd run build
```

`/api/bank` reads local `Resource/*_current.json` files and answer files, filters hidden questions, and returns the `parts -> peaks -> cards -> questions` tree.

This API is useful for local Web development and optional mini-program debugging. It is not the production mini-program bank strategy.

## Static Preview

Main files:

- `preview/question-bank.js`
- `preview/climbing-map.html`
- `preview/card-practice.html`
- `preview/examiner.html`
- `preview/profile.html`

`preview/question-bank.js` reads only current bank files and current answer files. It also filters hidden questions before rendering.

Run with a local static server from repo root:

```bash
python -m http.server 8000
```

## Mini Program

Main files:

- `miniprogram/src/lib/api.ts`
- `miniprogram/src/assets/question-bank.generated.json`
- `miniprogram/src/lib/question-bank.generated.ts`
- `miniprogram/cloudfunctions/score-service/`
- `miniprogram/src/pages/map/index.tsx`
- `miniprogram/src/pages/practice/index.tsx`
- `miniprogram/config/index.ts`

Current bank priority:

```text
WeChat Cloud Database current bank
-> local Taro storage cache from the last successful cloud read
-> bundled current fallback JSON
```

The mini program no longer depends on the developer computer being on the same network. Local `/api/bank` is only used when `USE_LOCAL_BANK_API=1` is set during build.

Production scoring also runs inside the same WeChat CloudBase environment through the `score-service` cloud function. The client uploads the PCM take to temporary cloud storage, calls the cloud function with the file ID, and the function deletes the temporary file after scoring.

The bundled fallback JSON is `miniprogram/src/assets/question-bank.generated.json`. It keeps current questions only and intentionally strips long answers so it stays small. Full sample answers come from the cloud database or cache.

Build:

```bash
cd miniprogram
npm.cmd run build:weapp
```

Cloud build:

```bash
cd miniprogram
$env:CLOUD_ENV_ID="your-cloud-env-id"
npm.cmd run build:weapp
```

The mini program only needs to be rebuilt when the cloud environment ID changes, mini-program code changes, fallback structure changes, or a new mini-program release is needed. Routine question-bank updates should only run `npm.cmd run bank:publish` from the repo root.

## Cloud Bank Workflow

Root scripts:

- `npm run bank:scrape`: scrape Papaen current source data into `Resource/`.
- `npm run bank:answers`: generate Band 7 sample answers with the configured OpenAI-compatible LLM. It requires `DEEPSEEK_API_KEY` or `LLM_API_KEY` and reuses `Resource/band7_answer_cache.json` by question id/content hash.
- `npm run bank:miniprogram`: generate `miniprogram/src/lib/question-bank.generated.ts` and `miniprogram/src/assets/question-bank.generated.json`.
- `npm run bank:cloud-seed`: export cloud database seed files to `dist/cloud-bank/`.
- `npm run bank:cloud-publish`: upload the generated seed files to WeChat CloudBase.
- `npm run bank:update`: run all of the above in order.
- `npm run bank:publish`: run `bank:update`, then upload and activate the new cloud bank.

Publish writes `bank_parts` first and switches `bank_manifest/active` last, so users never read a half-updated bank.

Cloud collections:

- `bank_manifest`
  - document `_id = active`
  - `activeVersion`
  - `parts`
- `bank_parts`
  - `version`
  - `name`
  - `order`
  - `part`

User-facing mini-program updates should happen by changing the active cloud bank version, not by requiring a new mini-program release every time.

Current deployed cloud environment used in local builds:

```text
cloud1-d9g4ihxcx7878af8c
```

Cloud read permissions for both collections should allow public reads and block client writes:

```json
{
  "read": true,
  "write": false
}
```

One-time local setup for publishing:

```text
CLOUD_ENV_ID=your-cloud-env-id
TENCENTCLOUD_SECRETID=your-tencent-cloud-secret-id
TENCENTCLOUD_SECRETKEY=your-tencent-cloud-secret-key
```

Put those values in `.env.local`. That file is gitignored.

## Cloud Scoring Workflow

Cloud function:

- `miniprogram/cloudfunctions/score-service`

It serves both scoring actions:

- `score-audio`: read-aloud pronunciation scoring via XFYUN ISE.
- `score-speaking`: open IELTS answer scoring via XFYUN ASR + DeepSeek-compatible LLM.

Set these environment variables on the cloud function, not in the mini-program package:

```text
XFYUN_APP_ID
XFYUN_API_KEY
XFYUN_API_SECRET
XFYUN_ASR_APP_ID
XFYUN_ASR_API_KEY
XFYUN_ASR_API_SECRET
DEEPSEEK_API_KEY
```

`XFYUN_ASR_*` can be omitted if the same XFYUN app supports both ASR and ISE; the function falls back to `XFYUN_*`.

Upload/deploy from WeChat Developer Tools:

```text
Import miniprogram/
Right click cloudfunctions/score-service
Upload and deploy: cloud install dependencies
```

Mini-program production builds should leave `API_BASE_URL` empty so scoring uses CloudBase. Set `API_BASE_URL` only for local or temporary HTTPS backend debugging.

## Generated Files

Do not hand-edit:

- `.next/`
- `node_modules/`
- `miniprogram/node_modules/`
- `miniprogram/dist/`
- `miniprogram/.swc/`
- `tsconfig.tsbuildinfo`

Usually do not hand-edit unless intentionally regenerating:

- `miniprogram/src/lib/question-bank.generated.ts`
- `miniprogram/src/assets/question-bank.generated.json`
- `dist/cloud-bank/*`

## Where To Edit

Question-bank source and generation:

- `Resource/`
- `scripts/scrape-papaen-questions.mjs`
- `scripts/generate-band7-answers.mjs`
- `scripts/generate-miniprogram-bank.mjs`
- `scripts/export-cloud-bank-seed.mjs`
- `scripts/publish-cloud-bank.mjs`

Web/PWA behavior:

- `lib/question-bank.ts`
- `app/*`

Preview behavior:

- `preview/question-bank.js`
- `preview/*.html`

Mini-program behavior:

- `miniprogram/src/lib/api.ts`
- `miniprogram/src/pages/*`

Scoring:

- `app/api/score/route.ts`
- `lib/iflytek-ise.ts`
- `lib/score-map.ts`
- `lib/llm.ts`
- `miniprogram/src/lib/recorder.ts`
