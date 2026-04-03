import { createLogger } from "../lib/logger.js";
import type { PredictionRecord, MarketSignal } from "../markets/types.js";

const log = createLogger("Tracker");

export interface AccuracyStats {
  total: number;
  resolved: number;
  correct: number;
  accuracy: number;
  avgEdge: number;
  avgConfidence: number;
  byCategory: Record<string, { total: number; correct: number; accuracy: number }>;
}

export class PredictionTracker {
  private records = new Map<string, PredictionRecord>();

  record(signal: MarketSignal, category: string): PredictionRecord {
    const rec: PredictionRecord = {
      marketId: signal.marketId,
      question: signal.question,
      category,
      aiPct: signal.aiPct,
      polymarketPct: signal.polymarketPct,
      edgePct: signal.edgePct,
      recommendedSide: signal.recommendedSide,
      confidence: signal.confidence,
      predictedAt: signal.scoredAt,
      resolved: false,
    };

    this.records.set(signal.marketId, rec);
    log.debug("Prediction recorded", { market: signal.marketId });
    return rec;
  }

  resolve(marketId: string, resolvedYes: boolean): PredictionRecord | null {
    const rec = this.records.get(marketId);
    if (!rec) return null;

    rec.resolved = true;
    rec.resolvedYes = resolvedYes;
    rec.resolvedAt = Date.now();

    // Correct if: recommended YES and resolved YES, or recommended NO and resolved NO
    if (rec.recommendedSide === "YES") {
      rec.correct = resolvedYes;
    } else if (rec.recommendedSide === "NO") {
      rec.correct = !resolvedYes;
    } else {
      // No position taken — track AI accuracy regardless
      rec.correct = resolvedYes ? rec.aiPct >= 50 : rec.aiPct < 50;
    }

    log.info("Prediction resolved", {
      market: rec.question.slice(0, 50),
      aiPct: rec.aiPct.toFixed(1),
      resolvedYes,
      correct: rec.correct,
    });

    return rec;
  }

  getStats(): AccuracyStats {
    const all = [...this.records.values()];
    const resolved = all.filter((r) => r.resolved);
    const correct = resolved.filter((r) => r.correct);

    const byCategory: AccuracyStats["byCategory"] = {};
    for (const r of resolved) {
      if (!byCategory[r.category]) {
        byCategory[r.category] = { total: 0, correct: 0, accuracy: 0 };
      }
      byCategory[r.category].total++;
      if (r.correct) byCategory[r.category].correct++;
    }
    for (const cat of Object.values(byCategory)) {
      cat.accuracy = cat.total > 0 ? cat.correct / cat.total : 0;
    }

    const avgEdge =
      all.length > 0 ? all.reduce((s, r) => s + Math.abs(r.edgePct), 0) / all.length : 0;
    const avgConfidence =
      all.length > 0 ? all.reduce((s, r) => s + r.confidence, 0) / all.length : 0;

    return {
      total: all.length,
      resolved: resolved.length,
      correct: correct.length,
      accuracy: resolved.length > 0 ? correct.length / resolved.length : 0,
      avgEdge,
      avgConfidence,
      byCategory,
    };
  }

  getAll(): PredictionRecord[] {
    return [...this.records.values()];
  }

  getPending(): PredictionRecord[] {
    return [...this.records.values()].filter((r) => !r.resolved);
  }
}
