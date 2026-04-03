import { config } from "./lib/config.js";
import { createLogger } from "./lib/logger.js";
import { PolymarketClient } from "./markets/client.js";
import { MarketAnalyzer } from "./signals/analyzer.js";
import { OracleAgent } from "./oracle/agent.js";
import { PositionManager } from "./positions/manager.js";
import { PredictionTracker } from "./memory/tracker.js";
import { NewsFeed } from "./feeds/news.js";
import type { ScanCycle } from "./markets/types.js";

const log = createLogger("Omen");

async function runScanCycle(
  poly: PolymarketClient,
  analyzer: MarketAnalyzer,
  oracle: OracleAgent,
  positions: PositionManager,
  tracker: PredictionTracker
): Promise<ScanCycle> {
  const cycleId = `cycle-${Date.now()}`;
  const startedAt = Date.now();

  log.info("Scan cycle started", { cycleId });

  // 1. Fetch active markets
  const markets = await poly.getMarkets(config.MARKETS_PER_SCAN);
  log.info(`Fetched ${markets.length} markets`);

  // 2. Pre-filter
  const filtered = markets.filter((m) => {
    const { pass, reason } = analyzer.preFilter(m);
    if (!pass) log.debug("Filtered out", { id: m.id, reason });
    return pass;
  });

  log.info(`${filtered.length} markets passed pre-filter`);

  // 3. Score and take top N
  const scored = filtered
    .map((m) => ({ market: m, score: analyzer.score(m) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, config.TOP_N_TO_ANALYZE);

  log.info(`Analyzing top ${scored.length} markets`);

  let opportunitiesFound = 0;
  let positionsOpened = 0;

  // 4. Oracle analysis
  for (const { market, score } of scored) {
    log.info("Analyzing", {
      question: market.question.slice(0, 70),
      score: score.toFixed(2),
      yesPrice: (market.yesPrice * 100).toFixed(1) + "%",
    });

    const context = analyzer.buildContext(market);
    const signal = await oracle.predict(market, context);

    if (!signal) {
      log.debug("No signal returned", { market: market.id });
      continue;
    }

    tracker.record(signal, market.category);

    if (signal.recommendedSide) {
      opportunitiesFound++;
      log.info("Opportunity found", {
        question: market.question.slice(0, 60),
        side: signal.recommendedSide,
        edge: signal.edgePct.toFixed(1) + "%",
        confidence: signal.confidence.toFixed(2),
      });

      if (!config.DRY_RUN) {
        const position = positions.open(signal);
        if (position) positionsOpened++;
      } else {
        log.info("[DRY RUN] Would open position", {
          side: signal.recommendedSide,
          market: market.question.slice(0, 60),
        });
        positionsOpened++;
      }
    }
  }

  const stats = tracker.getStats();
  log.info("Cycle complete", {
    cycleId,
    scanned: markets.length,
    filtered: filtered.length,
    analyzed: scored.length,
    opportunities: opportunitiesFound,
    positionsOpened,
    accuracy: stats.resolved > 0 ? (stats.accuracy * 100).toFixed(1) + "%" : "n/a",
    bankroll: `$${positions.getBankroll().toFixed(2)}`,
  });

  return {
    cycleId,
    startedAt,
    completedAt: Date.now(),
    marketsScanned: markets.length,
    marketsFiltered: filtered.length,
    opportunitiesFound,
    positionsOpened,
    paperTrading: config.DRY_RUN,
  };
}

async function main() {
  log.info("Omen starting", {
    model: config.CLAUDE_MODEL,
    dryRun: config.DRY_RUN,
    bankroll: `$${config.PAPER_BANKROLL_USD}`,
    scanInterval: `${config.SCAN_INTERVAL_MS / 1000}s`,
  });

  const poly = new PolymarketClient();
  const analyzer = new MarketAnalyzer();
  const newsFeed = new NewsFeed();
  const oracle = new OracleAgent(newsFeed);
  const positions = new PositionManager();
  const tracker = new PredictionTracker();

  // Run first cycle immediately, then on interval
  await runScanCycle(poly, analyzer, oracle, positions, tracker);

  setInterval(async () => {
    try {
      await runScanCycle(poly, analyzer, oracle, positions, tracker);
    } catch (err) {
      log.error("Scan cycle failed", { err });
    }
  }, config.SCAN_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
