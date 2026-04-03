import { createLogger } from "../lib/logger.js";
import { config } from "../lib/config.js";
import type { Position, MarketSignal } from "../markets/types.js";
import { kellySize } from "./sizing.js";

const log = createLogger("PositionMgr");

export class PositionManager {
  private positions = new Map<string, Position>();
  private bankrollUsd: number;

  constructor() {
    this.bankrollUsd = config.PAPER_BANKROLL_USD;
  }

  /**
   * Evaluate a signal and open a paper position if criteria pass.
   */
  open(signal: MarketSignal): Position | null {
    if (!signal.recommendedSide) {
      log.debug("No side recommended — skipping", { market: signal.marketId });
      return null;
    }

    if (signal.confidence < config.CONFIDENCE_THRESHOLD) {
      log.debug("Confidence below threshold", {
        confidence: signal.confidence,
        threshold: config.CONFIDENCE_THRESHOLD,
      });
      return null;
    }

    if (Math.abs(signal.edgePct) < config.MIN_EDGE_PCT) {
      log.debug("Edge below minimum", {
        edge: signal.edgePct,
        min: config.MIN_EDGE_PCT,
      });
      return null;
    }

    if (this.positions.has(signal.marketId)) {
      log.debug("Position already open for market", { market: signal.marketId });
      return this.positions.get(signal.marketId)!;
    }

    const sizing = kellySize(signal, this.bankrollUsd);
    if (sizing.dollarSize < 1) {
      log.debug("Position size too small — skipping", { size: sizing.dollarSize });
      return null;
    }

    const entryPrice =
      signal.recommendedSide === "YES"
        ? signal.polymarketPct / 100
        : 1 - signal.polymarketPct / 100;

    const position: Position = {
      id: `${signal.marketId}-${Date.now()}`,
      marketId: signal.marketId,
      question: signal.question,
      side: signal.recommendedSide,
      entryPrice,
      currentPrice: entryPrice,
      contractQty: sizing.contractQty,
      dollarSize: sizing.dollarSize,
      unrealizedPnl: 0,
      status: "open",
      openedAt: Date.now(),
    };

    this.positions.set(signal.marketId, position);
    this.bankrollUsd -= sizing.dollarSize;

    log.info("Position opened", {
      market: signal.question.slice(0, 50),
      side: position.side,
      size: `$${sizing.dollarSize.toFixed(2)}`,
      qty: sizing.contractQty,
      entry: (entryPrice * 100).toFixed(1) + "%",
      cappedByRisk: sizing.cappedByRisk,
    });

    return position;
  }

  /**
   * Update mark-to-market price for an open position.
   */
  updatePrice(marketId: string, currentYesPrice: number): void {
    const pos = this.positions.get(marketId);
    if (!pos || pos.status !== "open") return;

    const currentPrice = pos.side === "YES" ? currentYesPrice : 1 - currentYesPrice;
    pos.currentPrice = currentPrice;
    pos.unrealizedPnl = (currentPrice - pos.entryPrice) * pos.contractQty;
  }

  /**
   * Close a position at resolution price.
   */
  close(marketId: string, resolvedYes: boolean): Position | null {
    const pos = this.positions.get(marketId);
    if (!pos || pos.status !== "open") return null;

    const resolvedPrice = pos.side === "YES" ? (resolvedYes ? 1 : 0) : (resolvedYes ? 0 : 1);
    const realizedPnl = (resolvedPrice - pos.entryPrice) * pos.contractQty;

    pos.currentPrice = resolvedPrice;
    pos.unrealizedPnl = 0;
    pos.realizedPnl = realizedPnl;
    pos.status = "closed";
    pos.closedAt = Date.now();

    this.bankrollUsd += pos.dollarSize + realizedPnl;

    log.info("Position closed", {
      market: pos.question.slice(0, 50),
      side: pos.side,
      pnl: `$${realizedPnl.toFixed(2)}`,
      outcome: resolvedYes ? "YES" : "NO",
      bankroll: `$${this.bankrollUsd.toFixed(2)}`,
    });

    return pos;
  }

  getOpen(): Position[] {
    return [...this.positions.values()].filter((p) => p.status === "open");
  }

  getAll(): Position[] {
    return [...this.positions.values()];
  }

  getBankroll(): number {
    return this.bankrollUsd;
  }

  getTotalUnrealized(): number {
    return this.getOpen().reduce((sum, p) => sum + p.unrealizedPnl, 0);
  }
}
