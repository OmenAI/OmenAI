// ─── Market ───────────────────────────────────────────────────────────────────

export type MarketStatus = "open" | "closed" | "resolved";
export type MarketOutcome = "YES" | "NO";

export interface Market {
  id: string;
  conditionId: string;
  question: string;
  description: string;
  category: string;
  endDate: number;
  status: MarketStatus;
  yesPrice: number;     // 0–1 (current Polymarket YES price)
  noPrice: number;
  volume24h: number;
  volumeTotal: number;
  liquidityUsd: number;
  resolvedOutcome?: MarketOutcome;
  createdAt: number;
}

// ─── Signal ───────────────────────────────────────────────────────────────────

export interface MarketSignal {
  marketId: string;
  question: string;
  category: string;
  polymarketPct: number;    // current Polymarket YES probability (0–100)
  aiPct: number;            // Omen's estimated YES probability (0–100)
  edgePct: number;          // aiPct - polymarketPct
  recommendedSide: MarketOutcome | null;
  confidence: number;       // 0–1
  calibrationPenalty: number;
  reasoning: string;
  scoredAt: number;
}

// ─── Position ─────────────────────────────────────────────────────────────────

export interface Position {
  id: string;
  marketId: string;
  question: string;
  category: string;
  side: MarketOutcome;
  entryPrice: number;       // 0–1
  currentPrice: number;     // 0–1
  contractQty: number;
  dollarSize: number;
  unrealizedPnl: number;
  realizedPnl?: number;
  status: "open" | "closed";
  openedAt: number;
  closedAt?: number;
}

// ─── Prediction history ────────────────────────────────────────────────────────

export interface PredictionRecord {
  marketId: string;
  question: string;
  category: string;
  aiPct: number;
  polymarketPct: number;
  edgePct: number;
  recommendedSide: MarketOutcome | null;
  confidence: number;
  predictedAt: number;
  resolved: boolean;
  resolvedYes?: boolean;
  resolvedAt?: number;
  correct?: boolean;
}

// ─── Scan cycle ────────────────────────────────────────────────────────────────

export interface ScanCycle {
  cycleId: string;
  startedAt: number;
  completedAt?: number;
  marketsScanned: number;
  marketsFiltered: number;
  opportunitiesFound: number;
  positionsOpened: number;
  paperTrading: boolean;
}

