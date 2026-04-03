import type { Market, MarketSignal } from "../markets/types.js";

export function buildSignal(
  market: Market,
  aiPct: number,
  confidence: number,
  reasoning: string
): MarketSignal {
  const edgePct = aiPct - market.yesPrice * 100;
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
