# Changelog

## [1.0.0] — 2026-04-03

### Added
- `OracleAgent` — Claude-powered multi-turn prediction loop with 4 tools
- `MarketAnalyzer` — pre-filter (liquidity, days, price range) + opportunity scoring
- `PositionManager` — paper position tracking with mark-to-market
- `PredictionTracker` — accuracy history and calibration stats
- Kelly criterion position sizer with fractional Kelly + confidence scaling
- NewsAPI integration for real-time context injection
- Resolution criteria analysis with ambiguity detection
- Zod config validation — fails fast on bad env
- Docker + docker-compose for containerised deployment
- Full test suite: signal building, filtering, sizing, tracking

