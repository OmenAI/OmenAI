import type { Market } from "../markets/types.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("Resolution");

export interface ResolutionContext {
  criteria: string;
  endDateIso: string;
  daysRemaining: number;
  ambiguityScore: number; // 0 (clear) → 1 (very ambiguous)
  flags: string[];
}

const AMBIGUITY_PATTERNS = [
  { pattern: /at least/i, weight: 0.1 },
  { pattern: /approximately/i, weight: 0.15 },
  { pattern: /official(ly)?/i, weight: 0.05 },
  { pattern: /or more/i, weight: 0.1 },
  { pattern: /before (the )?(end|close)/i, weight: 0.05 },
  { pattern: /subject to/i, weight: 0.2 },
  { pattern: /discretion/i, weight: 0.25 },
  { pattern: /may/i, weight: 0.1 },
];

/**
 * Parse a market's description to extract resolution context and flag ambiguities.
 */
export function analyzeResolution(market: Market): ResolutionContext {
  const description = market.description ?? "";
  const endDate = new Date(market.endDate);
  const daysRemaining = (market.endDate - Date.now()) / (24 * 60 * 60 * 1000);

  let ambiguityScore = 0;
  const flags: string[] = [];

  for (const { pattern, weight } of AMBIGUITY_PATTERNS) {
    if (pattern.test(description)) {
      ambiguityScore += weight;
      flags.push(pattern.source);
    }
  }

  ambiguityScore = Math.min(ambiguityScore, 1);

  if (description.length < 50) {
    ambiguityScore = Math.min(ambiguityScore + 0.3, 1);
    flags.push("short description — resolution criteria unclear");
  }

  log.debug("Resolution analyzed", {
    market: market.id,
    ambiguity: ambiguityScore.toFixed(2),
    flags: flags.length,
  });

  return {
    criteria: description || "Resolves YES if the stated event occurs before the closing date.",
    endDateIso: endDate.toISOString(),
    daysRemaining: Math.max(daysRemaining, 0),
    ambiguityScore,
    flags,
  };
}

