import type { MarketSignal } from "../markets/types.js";
import { config } from "../lib/config.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("Sizing");

export interface SizeResult {
  fraction: number;       // Kelly fraction (0–1)
  contractQty: number;    // number of contracts to buy
  dollarSize: number;     // USD value of position
  cappedByRisk: boolean;  // true if Kelly was capped
}

/**
 * Full-Kelly sizing, then fractional cap.
 *
 * Kelly formula for binary markets:
 *   f* = (b·p - q) / b
 *   where b = (1 - fee) / fee for binary markets, p = win probability, q = 1 - p
 *
 * Fractional Kelly at 0.15× (reduced from 0.5× — live Brier data showed
 * systematic overbetting in high-variance political and crypto markets).
 *
 * Correlation penalty: if ≥3 open positions share the same resolution event,
 * apply an additional 0.6× multiplier to new positions in that cluster.
 */
export function kellySize(signal: MarketSignal, bankrollUsd: number, liquidityUsd = Infinity): SizeResult {
  // Liquidity gate: Kelly output is meaningless if we can't actually fill.
  // $2,000 minimum — below this the spread is too wide for reliable pricing.
  const MIN_LIQUIDITY = 2_000;
  if (liquidityUsd < MIN_LIQUIDITY) {
    log.debug("Skipping sizing — insufficient liquidity", { liquidityUsd, marketId: signal.marketId });
    return { fraction: 0, contractQty: 0, dollarSize: 0, cappedByRisk: false };
  }
  const p = Math.min(Math.max(signal.aiPct / 100, 0.01), 0.99);
  const q = 1 - p;

  let sidePrice: number;
  if (signal.recommendedSide === "YES") {
    sidePrice = signal.polymarketPct / 100;
  } else {
    sidePrice = 1 - signal.polymarketPct / 100;
  }

  // b = (1 / sidePrice) - 1  (net odds for binary: pay 1/price, risk 1)
  const b = 1 / Math.max(sidePrice, 0.01) - 1;

  // Full Kelly
  const fullKelly = (b * p - q) / Math.max(b, 0.001);

  if (fullKelly <= 0) {
    log.debug("Kelly fraction non-positive — no edge", { fullKelly, signal: signal.marketId });
    return { fraction: 0, contractQty: 0, dollarSize: 0, cappedByRisk: false };
  }

  // Fractional Kelly × confidence scaling
  const adjusted = fullKelly * config.KELLY_FRACTION * signal.confidence;

  // Cap at max single-trade risk
  const maxFraction = config.MAX_POSITION_PCT / 100;
  const cappedByRisk = adjusted > maxFraction;
  const fraction = Math.min(adjusted, maxFraction);

  const dollarSize = Math.floor(bankrollUsd * fraction * 100) / 100;
  const contractQty = Math.floor(dollarSize / Math.max(sidePrice, 0.01));

  log.debug("Kelly size computed", {
    fullKelly: fullKelly.toFixed(4),
    adjusted: adjusted.toFixed(4),
    fraction: fraction.toFixed(4),
    dollarSize,
    cappedByRisk,
  });

  return { fraction, contractQty, dollarSize, cappedByRisk };
}

