import type { PluginInput } from "@opencode-ai/plugin";

type LogLevel = "debug" | "info" | "warn" | "error";

export interface PluginLogger {
  debug(message: string, extra?: Record<string, unknown>): Promise<void>;
  info(message: string, extra?: Record<string, unknown>): Promise<void>;
  warn(message: string, extra?: Record<string, unknown>): Promise<void>;
  error(message: string, extra?: Record<string, unknown>): Promise<void>;
}

export function createPluginLogger(
  client: PluginInput["client"],
  directory: string,
): PluginLogger {
  async function write(level: LogLevel, message: string, extra?: Record<string, unknown>) {
    try {
      await client.app.log({
        query: { directory },
        body: {
          service: "kompass",
          level,
          message,
          ...(extra ? { extra } : {}),
        },
      });
    } catch {
      // Swallow log write failures so plugin behavior never depends on logging.
    }
  }

  return {
    debug: (message, extra) => write("debug", message, extra),
    info: (message, extra) => write("info", message, extra),
    warn: (message, extra) => write("warn", message, extra),
    error: (message, extra) => write("error", message, extra),
  };
}
