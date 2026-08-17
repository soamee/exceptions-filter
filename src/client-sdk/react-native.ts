import { ErrorReporter } from "./reporter";

let _reporter: ErrorReporter | null = null;

export function initErrorReporter(config: {
  apiUrl: string;
  appVersion: string;
  userId?: string;
}): ErrorReporter {
  // Detect platform at runtime
  let platform: "ios" | "android" = "ios";
  try {
    const { Platform } = require("react-native");
    platform = Platform.OS === "android" ? "android" : "ios";
  } catch {
    // Fallback to ios
  }

  _reporter = new ErrorReporter({ ...config, platform });

  // Hook into React Native's global error handler
  try {
    const ErrorUtils = (globalThis as any).ErrorUtils;
    if (ErrorUtils) {
      const prevHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        _reporter?.report({
          message: error.message,
          stack: error.stack,
          metadata: { isFatal },
        });
        prevHandler?.(error, isFatal);
      });
    }
  } catch {
    // ErrorUtils not available
  }

  // Hook unhandled promise rejections
  const tracking = require("promise/setimmediate/rejection-tracking");
  if (tracking) {
    try {
      tracking.enable({
        allRejections: true,
        onUnhandled: (_id: number, error: Error) => {
          _reporter?.report({
            message: error?.message ?? String(error),
            stack: error?.stack,
          });
        },
      });
    } catch {
      // Rejection tracking not available
    }
  }

  return _reporter;
}

export function reportError(
  error: Error,
  context?: { screen?: string; metadata?: Record<string, unknown> },
): void {
  _reporter?.report({
    message: error.message,
    stack: error.stack,
    ...context,
  });
}

export function setCurrentScreen(name: string): void {
  _reporter?.setCurrentScreen(name);
}

export { ErrorReporter } from "./reporter";
