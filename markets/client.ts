import { createLogger } from "../lib/logger.js";
import { config } from "../lib/config.js";
import type { Market } from "./types.js";

const log = createLogger("PolyClient");

const CLOB_BASE = "https://clob.polymarket.com";
const GAMMA_BASE = "https://gamma-api.polymarket.com";

export class PolymarketClient {
  async getMarkets(limit = 100, offset = 0): Promise<Market[]> {
    try {
      const res = await fetch(
        `${GAMMA_BASE}/markets?limit=${limit}&offset=${offset}&active=true&closed=false&order=volumeNum&ascending=false`
      );
      const data = (await res.json()) as Array<{
        id?: string;
        conditionId?: string;
        question?: string;
        description?: string;
        groupItemTitle?: string;
        endDate?: string;
        active?: boolean;
        volume?: string;
        volume24hr?: number;
        liquidity?: string;
        outcomePrices?: string;
        outcomes?: string;
      }>;

      return data.map((m) => {
        const prices = this.parsePrices(m.outcomePrices);
        return {
          id: String(m.id ?? ""),
          conditionId: String(m.conditionId ?? ""),
          question: String(m.question ?? ""),
          description: String(m.description ?? ""),
          category: String(m.groupItemTitle ?? "General"),
          endDate: m.endDate ? new Date(m.endDate).getTime() : 0,
          status: "open",
          yesPrice: prices.yes,
          noPrice: prices.no,
          volume24h: Number(m.volume24hr ?? 0),
          volumeTotal: Number(m.volume ?? 0),
          liquidityUsd: Number(m.liquidity ?? 0),
          createdAt: Date.now(),
        };
      });
    } catch (err) {
      log.error("Failed to fetch markets", { err });
      return [];
    }
  }

  async getMarket(conditionId: string): Promise<Market | null> {
    try {
      const res = await fetch(`${GAMMA_BASE}/markets/${conditionId}`);
      const m = (await res.json()) as {
        id?: string;
        conditionId?: string;
        question?: string;
        description?: string;
        endDate?: string;
        volume?: string;
        volume24hr?: number;
        liquidity?: string;
        outcomePrices?: string;
      };
      const prices = this.parsePrices(m.outcomePrices);
      return {
        id: String(m.id ?? ""),
        conditionId,
        question: String(m.question ?? ""),
        description: String(m.description ?? ""),
        category: "General",
        endDate: m.endDate ? new Date(m.endDate).getTime() : 0,
        status: "open",
        yesPrice: prices.yes,
        noPrice: prices.no,
        volume24h: Number(m.volume24hr ?? 0),
        volumeTotal: Number(m.volume ?? 0),
        liquidityUsd: Number(m.liquidity ?? 0),
        createdAt: Date.now(),
      };
    } catch (err) {
      log.error("Failed to fetch market", { conditionId, err });
      return null;
    }
  }

  private parsePrices(raw?: string): { yes: number; no: number } {
    try {
      const arr = JSON.parse(raw ?? "[0.5,0.5]") as number[];
      return { yes: Number(arr[0] ?? 0.5), no: Number(arr[1] ?? 0.5) };
    } catch {
      return { yes: 0.5, no: 0.5 };
    }
  }
}
