import { config } from "../lib/config.js";
import type { Market, MarketSignal } from "../markets/types.js";

export function buildSignal(
  market: Market,
  aiPct: number,
  confidence: number,
  reasoning: string,
  calibrationPenalty = 1
): MarketSignal {
  const marketPct = market.yesPrice * 100;
  const edgePct = aiPct - marketPct;
  const absEdge = Math.abs(edgePct);

  let recommendedSide: MarketSignal["recommendedSide"] = null;
  if (absEdge >= config.MIN_EDGE_PCT) {
    recommendedSide = edgePct > 0 ? "YES" : "NO";
  }

  return {
    marketId: market.id,
    question: market.question,
    category: market.category,
    polymarketPct: marketPct,
    aiPct,
    edgePct,
    recommendedSide,
    confidence,
    calibrationPenalty,
    reasoning,
    scoredAt: Date.now(),
  };
}

