# Omen — Architecture

## Overview

Omen is a stateless, event-driven prediction agent. Each scan cycle fetches markets from Polymarket, pre-filters noise, scores opportunities, and dispatches the top candidates to a Claude-powered oracle.

```
Polymarket API
     │
     ▼
PolymarketClient         ← markets/client.ts
     │
     ▼
MarketAnalyzer
├── preFilter()          ← liquidity, days, price range
└── score()              ← volume, sweet-spot days, mid-range price

     │ top-N markets
     ▼
OracleAgent              ← oracle/agent.ts
├── get_news_context     → NewsFeed.search()
├── get_resolution_criteria
├── get_historical_accuracy
└── predict              → buildSignal() → MarketSignal

     │ signal
     ▼
PositionManager          ← positions/manager.ts
└── kellySize()          ← positions/sizing.ts

     │
     ▼
PredictionTracker        ← memory/tracker.ts
```

## Agent Loop

The oracle uses the Anthropic SDK's tool-use pattern:

1. User message: market context string
2. Claude calls `get_news_context` → news items returned
3. Claude calls `get_resolution_criteria` → criteria returned
4. Claude reasons over base rates + evidence
5. Claude calls `predict` → signal captured, loop exits

## Kelly Sizing

Full-Kelly: `f* = (b·p - q) / b`

Omen applies:
- **Fractional Kelly** (default 0.5×) to halve variance
- **Confidence scaling** — multiplies by `signal.confidence`
- **Hard cap** — never exceeds `MAX_POSITION_PCT` of bankroll

## Configuration

All thresholds are environment-driven via Zod schema validation. See `.env.example` for all knobs.

