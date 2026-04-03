import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildSignal } from "../signals/scorer.js";
import { MarketAnalyzer } from "../signals/analyzer.js";
import { kellySize } from "../positions/sizing.js";
import { PredictionTracker } from "../memory/tracker.js";
import type { Market, MarketSignal } from "../markets/types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMarket(overrides: Partial<Market> = {}): Market {
  return {
    id: "test-market-1",
    conditionId: "0xabc",
    question: "Will BTC exceed $100k by end of 2025?",
    description: "Resolves YES if BTC closing price exceeds $100,000 on any day before Dec 31 2025.",
    category: "crypto",
    endDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    status: "open",
    yesPrice: 0.45,
    noPrice: 0.55,
    volume24h: 50_000,
    volumeTotal: 500_000,
    liquidityUsd: 100_000,
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeSignal(overrides: Partial<MarketSignal> = {}): MarketSignal {
  return {
    marketId: "test-market-1",
    question: "Will BTC exceed $100k?",
    polymarketPct: 45,
    aiPct: 62,
    edgePct: 17,
    recommendedSide: "YES",
    confidence: 0.75,
    reasoning: "Strong momentum and institutional adoption accelerating.",
    scoredAt: Date.now(),
    ...overrides,
  };
}

// ─── buildSignal ──────────────────────────────────────────────────────────────

describe("buildSignal", () => {
  it("computes edge correctly", () => {
    const market = makeMarket({ yesPrice: 0.4 });
    const signal = buildSignal(market, 60, 0.8, "test reasoning");
    expect(signal.edgePct).toBeCloseTo(20, 1); // 60 - 40 = 20
  });

  it("recommends YES when aiPct > polymarketPct by >= 10", () => {
    const market = makeMarket({ yesPrice: 0.4 });
    const signal = buildSignal(market, 55, 0.7, "");
    expect(signal.recommendedSide).toBe("YES");
  });

  it("recommends NO when polymarketPct > aiPct by >= 10", () => {
    const market = makeMarket({ yesPrice: 0.7 });
    const signal = buildSignal(market, 55, 0.7, "");
    expect(signal.recommendedSide).toBe("NO");
  });

  it("returns null side when edge < 10%", () => {
    const market = makeMarket({ yesPrice: 0.5 });
    const signal = buildSignal(market, 54, 0.7, "");
    expect(signal.recommendedSide).toBeNull();
  });
});

// ─── MarketAnalyzer ──────────────────────────────────────────────────────────

describe("MarketAnalyzer.preFilter", () => {
  const analyzer = new MarketAnalyzer();

  it("rejects low liquidity", () => {
    const m = makeMarket({ liquidityUsd: 500 });
    expect(analyzer.preFilter(m).pass).toBe(false);
  });

  it("rejects near-certainty prices", () => {
    const m = makeMarket({ yesPrice: 0.95 });
    expect(analyzer.preFilter(m).pass).toBe(false);
  });

  it("rejects markets closing too soon", () => {
    const m = makeMarket({ endDate: Date.now() + 1 * 24 * 60 * 60 * 1000 }); // 1 day
    expect(analyzer.preFilter(m).pass).toBe(false);
  });

  it("accepts a healthy market", () => {
    const m = makeMarket();
    expect(analyzer.preFilter(m).pass).toBe(true);
  });
});

describe("MarketAnalyzer.score", () => {
  const analyzer = new MarketAnalyzer();

  it("gives higher score to mid-range markets", () => {
    const midMarket = makeMarket({ yesPrice: 0.5 });
    const extremeMarket = makeMarket({ yesPrice: 0.85 });
    expect(analyzer.score(midMarket)).toBeGreaterThan(analyzer.score(extremeMarket));
  });
});

// ─── Kelly sizing ─────────────────────────────────────────────────────────────

describe("kellySize", () => {
  it("returns zero size when AI confidence equals market price", () => {
    const signal = makeSignal({ aiPct: 45, polymarketPct: 45, edgePct: 0 });
    const result = kellySize(signal, 1000);
    expect(result.fraction).toBe(0);
    expect(result.dollarSize).toBe(0);
  });

  it("caps position at MAX_POSITION_PCT of bankroll", () => {
    const signal = makeSignal({ aiPct: 99, confidence: 1 }); // extreme edge
    const result = kellySize(signal, 10_000);
    // Should be capped at 5% = $500
    expect(result.dollarSize).toBeLessThanOrEqual(500 + 1); // allow float rounding
    expect(result.cappedByRisk).toBe(true);
  });

  it("scales with confidence", () => {
    const highConf = makeSignal({ confidence: 0.9 });
    const lowConf = makeSignal({ confidence: 0.4 });
    expect(kellySize(highConf, 1000).dollarSize).toBeGreaterThan(
      kellySize(lowConf, 1000).dollarSize
    );
  });
});

// ─── PredictionTracker ───────────────────────────────────────────────────────

describe("PredictionTracker", () => {
  let tracker: PredictionTracker;

  beforeEach(() => {
    tracker = new PredictionTracker();
  });

  it("records and resolves a prediction correctly", () => {
    const signal = makeSignal();
    tracker.record(signal, "crypto");
    const rec = tracker.resolve("test-market-1", true);
    expect(rec?.correct).toBe(true); // recommended YES, resolved YES
  });

  it("marks incorrect when NO recommendation resolves YES", () => {
    const signal = makeSignal({ recommendedSide: "NO" });
    tracker.record(signal, "crypto");
    const rec = tracker.resolve("test-market-1", true);
    expect(rec?.correct).toBe(false);
  });

  it("computes accuracy stats correctly", () => {
    const s1 = makeSignal({ marketId: "m1" });
    const s2 = makeSignal({ marketId: "m2", recommendedSide: "NO" });
    tracker.record(s1, "crypto");
    tracker.record(s2, "crypto");
    tracker.resolve("m1", true);  // correct
    tracker.resolve("m2", true);  // incorrect (NO recommended, YES resolved)

    const stats = tracker.getStats();
    expect(stats.resolved).toBe(2);
    expect(stats.correct).toBe(1);
    expect(stats.accuracy).toBeCloseTo(0.5);
  });
});

