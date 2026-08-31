import type { PluginInput } from "./legacy-plugin.ts";

type LogLevel = "debug" | "info" | "warn" | "error";

export interface PluginLogger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
}

export function getErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      error: error.message,
      name: error.name,
    };
  }

  return { error: String(error) };
}

export function createPluginLogger(
  clientOrDirectory: PluginInput["client"] | string,
  directory = typeof clientOrDirectory === "string" ? clientOrDirectory : "",
): PluginLogger {
  if (typeof clientOrDirectory === "string") {
    function write(level: LogLevel, message: string, extra?: Record<string, unknown>) {
      const output = extra ? [`[kompass] ${message}`, { directory, ...extra }] : [`[kompass] ${message}`];
      console[level](...output);
    }
    return {
      debug: (message, extra) => write("debug", message, extra),
      info: (message, extra) => write("info", message, extra),
      warn: (message, extra) => write("warn", message, extra),
      error: (message, extra) => write("error", message, extra),
    };
  }
  const client = clientOrDirectory;

  function dispatch(level: LogLevel, message: string, extra?: Record<string, unknown>) {
    void client.app.log({
      query: { directory },
      body: {
        service: "kompass",
        level,
        message: `[kompass] ${message}`,
        ...(extra ? { extra } : {}),
      },
    }).catch((err: unknown) => {
      // Log to console for debugging; plugin behavior must not depend on logging.
      console.error("[kompass] Log write failed:", err);
    });
  }

  return {
    debug: (message, extra) => dispatch("debug", message, extra),
    info: (message, extra) => dispatch("info", message, extra),
    warn: (message, extra) => dispatch("warn", message, extra),
    error: (message, extra) => dispatch("error", message, extra),
  };
}
