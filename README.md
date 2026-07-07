# Speaker

Speaker is an IELTS speaking practice app: question-bank cards + a gamified climbing map. Three active surfaces:

- `app/` — Next.js Web/PWA plus backend API (question bank, pronunciation scoring).
- `miniprogram/` — WeChat mini program built with Taro ([miniprogram/README.md](./miniprogram/README.md)).
- `preview/` — static HTML prototype and visual reference.

## Docs

- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) — repo layout, question-bank data layering, cloud publish workflow. Read this first.
- [speaking_spec.md](./speaking_spec.md) — product spec and design rules.
- `docs/archive/` — dated historical snapshots.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). API keys for scoring go in `.env.local` (see `.env.example`).

Routine question-bank update (scrape, regenerate LLM sample answers with cache, publish to WeChat cloud):

```bash
npm.cmd run bank:publish
```

`bank:answers` requires `DEEPSEEK_API_KEY` or `LLM_API_KEY`; it will fail instead of falling back to offline templates.
