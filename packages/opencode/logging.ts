export interface PluginLogger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
}

export function getErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { error: error.message, name: error.name };
  }
  return { error: String(error) };
}

export function createPluginLogger(directory: string): PluginLogger {
  function format(message: string, extra?: Record<string, unknown>) {
    return extra ? [`[kompass] ${message}`, { directory, ...extra }] as const : [`[kompass] ${message}`] as const;
  }

  return {
    debug: (message, extra) => console.debug(...format(message, extra)),
    info: (message, extra) => console.info(...format(message, extra)),
    warn: (message, extra) => console.warn(...format(message, extra)),
    error: (message, extra) => console.error(...format(message, extra)),
  };
}
