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
          message: `[kompass] ${message}`,
          ...(extra ? { extra } : {}),
        },
      });
    } catch (err) {
      // Log to console for debugging; plugin behavior must not depend on logging.
      console.error("[kompass] Log write failed:", err);
    }
  }

  return {
    debug: (message, extra) => write("debug", message, extra),
    info: (message, extra) => write("info", message, extra),
    warn: (message, extra) => write("warn", message, extra),
    error: (message, extra) => write("error", message, extra),
  };
}
