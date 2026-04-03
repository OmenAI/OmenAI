# Omen — Claude Code Guide

## Project Overview

Omen is an autonomous prediction market scanner and analyst. It uses Claude as the reasoning engine inside a multi-turn agent loop to evaluate Polymarket markets and identify mispriced probabilities.

## Key Commands

```bash
bun run dev          # run with live reload
bun run test         # run test suite
bun run typecheck    # TypeScript strict check
bun run build        # compile to dist/
```

## Architecture

```
index.ts             main scan loop
oracle/agent.ts      Claude agent — tool loop + signal capture
oracle/prompts.ts    ORACLE_SYSTEM prompt
signals/analyzer.ts  pre-filter + scoring
signals/scorer.ts    buildSignal()
positions/manager.ts paper position tracking
positions/sizing.ts  Kelly criterion sizing
memory/tracker.ts    prediction history + accuracy stats
feeds/news.ts        NewsAPI integration
feeds/resolution.ts  resolution criteria analysis
lib/config.ts        Zod-validated env config
markets/client.ts    Polymarket CLOB + Gamma API
```

## Environment

Copy `.env.example` → `.env` and fill in `ANTHROPIC_API_KEY` at minimum.  
`DRY_RUN=true` (default) — no live positions opened, paper tracking only.

## Testing

Tests live in `tests/`. Run with `bun run test`. Coverage includes:
- `buildSignal` edge calculations
- `MarketAnalyzer` pre-filter and scoring
- Kelly sizing with caps
- `PredictionTracker` accuracy stats

## Style

- TypeScript strict mode throughout
- Zod validation at config boundaries
- No mocks in tests — pure unit tests on deterministic logic
- Structured logging via `createLogger(namespace)`
