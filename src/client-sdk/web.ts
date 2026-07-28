import { ErrorReporter } from "./reporter";

let _reporter: ErrorReporter | null = null;

export function initErrorReporter(config: {
  apiUrl: string;
  appVersion: string;
  userId?: string;
}): ErrorReporter {
  _reporter = new ErrorReporter({ ...config, platform: "web" });

  const _window = globalThis as any;

  _window.onerror = (
    message: any,
    source: any,
    lineno: any,
    colno: any,
    error: any,
  ) => {
    _reporter?.report({
      message: String(message),
      stack: error?.stack ?? `${source}:${lineno}:${colno}`,
      userAgent: _window.navigator?.userAgent,
    });
  };

  _window.onunhandledrejection = (event: any) => {
    const error = event.reason;
    _reporter?.report({
      message: error?.message ?? String(error),
      stack: error?.stack,
      userAgent: _window.navigator?.userAgent,
    });
  };

  return _reporter;
}

export function reportError(
  error: Error,
  context?: { screen?: string; metadata?: Record<string, unknown> },
): void {
  _reporter?.report({
    message: error.message,
    stack: error.stack,
    userAgent:
      typeof (globalThis as any).navigator !== "undefined"
        ? (globalThis as any).navigator.userAgent
        : undefined,
    ...context,
  });
}

export { ErrorReporter } from "./reporter";
