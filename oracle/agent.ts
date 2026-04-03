import Anthropic from "@anthropic-ai/sdk";
import { config } from "../lib/config.js";
import { createLogger } from "../lib/logger.js";
import type { Market, MarketSignal } from "../markets/types.js";
import { buildSignal } from "../signals/scorer.js";
import { ORACLE_SYSTEM } from "./prompts.js";
import type { NewsFeed } from "../feeds/news.js";

const log = createLogger("Oracle");

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_news_context",
    description: "Search for recent news and information relevant to this prediction market.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query related to the market question" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_resolution_criteria",
    description: "Get the exact resolution criteria for this market — what counts as YES vs NO.",
    input_schema: {
      type: "object" as const,
      properties: {
        market_id: { type: "string" },
      },
      required: ["market_id"],
    },
  },
  {
    name: "get_historical_accuracy",
    description: "Check Omen's historical accuracy on similar markets for calibration.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Market category e.g. politics, crypto" },
      },
      required: ["category"],
    },
  },
  {
    name: "predict",
    description: "Submit your final prediction. Call this LAST after all research is complete.",
    input_schema: {
      type: "object" as const,
      properties: {
        yes_probability: {
          type: "number",
          description: "Your estimated probability of YES (0–100)",
        },
        confidence: {
          type: "number",
          description: "Your confidence in this estimate (0–1)",
        },
        reasoning: {
          type: "string",
          description: "Full reasoning behind your prediction",
        },
        key_risks: {
          type: "array",
          items: { type: "string" },
          description: "Top 3 risks that could make this prediction wrong",
        },
      },
      required: ["yes_probability", "confidence", "reasoning", "key_risks"],
    },
  },
];

export class OracleAgent {
  private client: Anthropic;

  constructor(private newsFeed: NewsFeed) {
    this.client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }

  async predict(market: Market, context: string): Promise<MarketSignal | null> {
    log.info("Oracle evaluating market", {
      id: market.id,
      question: market.question.slice(0, 60),
    });

    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Analyze this Polymarket prediction market and provide your probability estimate.\n\n${context}`,
      },
    ];

    let signal: MarketSignal | null = null;

    agentLoop: while (true) {
      const response = await this.client.messages.create({
        model: config.CLAUDE_MODEL,
        max_tokens: 4096,
        system: ORACLE_SYSTEM,
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason === "end_turn") break agentLoop;

      if (response.stop_reason === "tool_use") {
        const toolBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
        );
        const results: Anthropic.ToolResultBlockParam[] = [];

        for (const tb of toolBlocks) {
          if (tb.name === "predict") {
            const inp = tb.input as {
              yes_probability: number;
              confidence: number;
              reasoning: string;
              key_risks: string[];
            };

            signal = buildSignal(
              market,
              inp.yes_probability,
              inp.confidence,
              `${inp.reasoning}\n\nKey risks: ${inp.key_risks.join("; ")}`
            );

            results.push({
              type: "tool_result",
              tool_use_id: tb.id,
              content: JSON.stringify({ received: true, signal }),
            });
            break agentLoop;
          }

          const result = await this.executeTool(tb.name, tb.input as Record<string, unknown>, market);
          results.push({ type: "tool_result", tool_use_id: tb.id, content: JSON.stringify(result) });
        }

        messages.push({ role: "assistant", content: response.content });
        if (results.length > 0) {
          messages.push({ role: "user", content: results });
        }
        continue;
      }

      break agentLoop;
    }

    if (signal) {
      log.info("Prediction complete", {
        question: market.question.slice(0, 60),
        aiPct: signal.aiPct.toFixed(1),
        polyPct: signal.polymarketPct.toFixed(1),
        edge: signal.edgePct.toFixed(1),
        side: signal.recommendedSide,
        confidence: signal.confidence,
      });
    }

    return signal;
  }

  private async executeTool(
    name: string,
    input: Record<string, unknown>,
    market: Market
  ): Promise<unknown> {
    switch (name) {
      case "get_news_context": {
        const query = String(input["query"] ?? market.question);
        return this.newsFeed.search(query);
      }

      case "get_resolution_criteria": {
        return {
          criteria: market.description || "Resolves YES if the stated event occurs before the end date.",
          endDate: new Date(market.endDate).toISOString(),
          resolver: "Polymarket UMA oracle",
        };
      }

      case "get_historical_accuracy": {
        // Returns mock accuracy stats — in production, query prediction history
        return {
          category: String(input["category"]),
          totalPredictions: 47,
          accuracy: 0.714,
          avgEdge: 12.3,
          note: "Based on last 90 days of resolved markets",
        };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }
}
