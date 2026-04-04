import { config } from "../lib/config.js";
import { createLogger } from "../lib/logger.js";
import type { Market, MarketSignal } from "../markets/types.js";

const log = createLogger("Analyzer");

export class MarketAnalyzer {
  /**
   * Pre-filter markets before sending to the Claude agent.
   * Eliminates noise — only high-quality opportunities reach the agent.
   */
  preFilter(market: Market): { pass: boolean; reason: string } {
    if (market.liquidityUsd < config.MIN_LIQUIDITY_USD) {
      return { pass: false, reason: `Liquidity $${market.liquidityUsd} below minimum` };
    }

    const daysToClose = (market.endDate - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysToClose < config.MIN_DAYS_TO_CLOSE) {
      return { pass: false, reason: `Closes in ${daysToClose.toFixed(1)}d — too soon` };
    }
    if (daysToClose > config.MAX_DAYS_TO_CLOSE) {
      return { pass: false, reason: `Closes in ${daysToClose.toFixed(1)}d — too far` };
    }

    // Skip near-certainty markets (>90% or <10%) — no edge to find
    if (market.yesPrice > 0.90 || market.yesPrice < 0.10) {
      return { pass: false, reason: `Price ${(market.yesPrice * 100).toFixed(0)}% — near certainty, skip` };
    }

    // No-trade window: skip markets resolving within NO_TRADE_WINDOW_HOURS
    const hoursToClose = (market.endDate - Date.now()) / (60 * 60 * 1000);
    if (hoursToClose < config.NO_TRADE_WINDOW_HOURS) {
      return { pass: false, reason: `Resolves in ${hoursToClose.toFixed(1)}h — inside no-trade window` };
    }

    return { pass: true, reason: "Passed pre-filter" };
  }

  /**
   * Score a market's attractiveness for prediction.
   * Higher score = more worth sending to Claude.
   */
  score(market: Market): number {
    let score = 0;

    // Volume signal — more volume = more market efficiency test needed
    if (market.volumeTotal > 1_000_000) score += 0.2;
    else if (market.volumeTotal > 100_000) score += 0.1;

    // Days to close sweet spot: 14–90 days
    const days = (market.endDate - Date.now()) / (24 * 60 * 60 * 1000);
    if (days >= 14 && days <= 90) score += 0.3;

    // Mid-range probability = more room for edge
    const distFromMid = Math.abs(market.yesPrice - 0.5);
    if (distFromMid < 0.2) score += 0.3;
    else if (distFromMid < 0.35) score += 0.15;

    // Category bonuses
    const highValueCategories = ["politics", "crypto", "finance", "economics"];
    if (highValueCategories.some((c) => market.category.toLowerCase().includes(c))) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  buildContext(market: Market): string {
    const days = ((market.endDate - Date.now()) / (24 * 60 * 60 * 1000)).toFixed(0);
    return [
      `Market: ${market.question}`,
      `Description: ${market.description.slice(0, 300)}`,
      `Category: ${market.category}`,
      `Current Polymarket YES price: ${(market.yesPrice * 100).toFixed(1)}%`,
      `Volume (total): $${(market.volumeTotal / 1000).toFixed(0)}K`,
      `Liquidity: $${(market.liquidityUsd / 1000).toFixed(0)}K`,
      `Closes in: ${days} days`,
    ].join("\n");
  }
}

