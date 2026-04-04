import type { Market, MarketSignal } from "../markets/types.js";

export function buildSignal(
  market: Market,
  aiPct: number,
  confidence: number,
  reasoning: string
): MarketSignal {
  // Use CLOB mid-price for edge calculation, not last-trade price.
  // Last trade can lag 8–12 minutes on thin books — mid-price reflects
  // current supply/demand and is the correct implied probability baseline.
  const midPrice = (market.yesPrice + (1 - market.noPrice)) / 2;
  const edgePct = aiPct - midPrice * 100;
  const absEdge = Math.abs(edgePct);

  let recommendedSide: MarketSignal["recommendedSide"] = null;
  if (absEdge >= 10) {
    recommendedSide = edgePct > 0 ? "YES" : "NO";
  }

  return {
    marketId: market.id,
    question: market.question,
    polymarketPct: market.yesPrice * 100,
    aiPct,
    edgePct,
    recommendedSide,
    confidence,
    reasoning,
    scoredAt: Date.now(),
  };
}

