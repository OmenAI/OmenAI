import { z } from "zod";

const ConfigSchema = z.object({
  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  CLAUDE_MODEL: z.string().default("claude-opus-4-6"),

  // News
  NEWSAPI_KEY: z.string().optional(),

  // Market filters
  MIN_LIQUIDITY_USD: z.coerce.number().default(10_000),
  MIN_DAYS_TO_CLOSE: z.coerce.number().default(3),
  MAX_DAYS_TO_CLOSE: z.coerce.number().default(180),

  // Edge / confidence thresholds
  MIN_EDGE_PCT: z.coerce.number().default(8),
  CONFIDENCE_THRESHOLD: z.coerce.number().default(0.6),

  // Position sizing
  KELLY_FRACTION: z.coerce.number().default(0.5),
  MAX_POSITION_PCT: z.coerce.number().default(5), // max % of bankroll per trade
  PAPER_BANKROLL_USD: z.coerce.number().default(1000),

  // Scan loop
  SCAN_INTERVAL_MS: z.coerce.number().default(5 * 60 * 1000),   // 5 min
  MARKETS_PER_SCAN: z.coerce.number().default(50),
  TOP_N_TO_ANALYZE: z.coerce.number().default(10),

  // Misc
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DRY_RUN: z
    .string()
    .optional()
    .transform((v) => v !== "false" && v !== "0")
    .default("true"),
});

function loadConfig() {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error("[Config] Validation failed:", result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = typeof config;

