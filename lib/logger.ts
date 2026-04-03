type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function getMinLevel(): Level {
  const env = process.env["LOG_LEVEL"] ?? "info";
  return (["debug", "info", "warn", "error"].includes(env) ? env : "info") as Level;
}

function format(level: Level, namespace: string, msg: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const metaStr = meta ? " " + JSON.stringify(meta) : "";
  return `${ts} [${level.toUpperCase().padEnd(5)}] [${namespace}] ${msg}${metaStr}`;
}

export function createLogger(namespace: string) {
  const minLevel = LEVELS[getMinLevel()];

  return {
    debug: (msg: string, meta?: unknown) => {
      if (LEVELS["debug"] >= minLevel) console.debug(format("debug", namespace, msg, meta));
    },
    info: (msg: string, meta?: unknown) => {
      if (LEVELS["info"] >= minLevel) console.info(format("info", namespace, msg, meta));
    },
    warn: (msg: string, meta?: unknown) => {
      if (LEVELS["warn"] >= minLevel) console.warn(format("warn", namespace, msg, meta));
    },
    error: (msg: string, meta?: unknown) => {
      if (LEVELS["error"] >= minLevel) console.error(format("error", namespace, msg, meta));
    },
  };
}

