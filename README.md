# D&D 5e Character Generator

React + TypeScript app for generating mechanically valid D&D 5e characters from minimal inputs.

## Features

- One-click, three-choice, and guided generation modes
- JSON-first validated character model (Zod)
- Reroll + per-section locks with deterministic seeds
- Complete sheet rendering + PDF export
- Backstory generation + portrait generation through pluggable AI provider
- IndexedDB persistence (save/list/search/sort/open/duplicate/delete)
- Export/import with schema migration entrypoint
- Level-up wizard with diff summary and advancement history

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env
```

Set these values in `.env`:

- `GEMINI_API_KEY` (server-side only)
- `AI_FEATURE_PASSWORD` (required to unlock AI actions)
- Optional: `VITE_USE_MOCK_AI=true` or `VITE_ALLOW_AI_FALLBACK=true`

3. Run:

```bash
npx vercel dev
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`

## Data files

Structured rules data lives in `src/data/*.json`.

## Notes

- Uses structured mechanics summaries only, avoids long source text blocks.
- PHB-core class/race/background scaffolding is included and easily extensible.
