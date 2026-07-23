import { IncomingHttpHeaders } from "http";
import { BASE_SENSITIVE_HEADERS } from "./sensitive-keys";

export function sanitizeHeaders(
  headers: IncomingHttpHeaders,
  extraSensitiveHeaders: string[] = [],
): IncomingHttpHeaders {
  const sensitiveSet = new Set([
    ...BASE_SENSITIVE_HEADERS,
    ...extraSensitiveHeaders.map((h) => h.toLowerCase()),
  ]);

  const sanitized = { ...headers };

  for (const headerName of sensitiveSet) {
    if (headerName in sanitized) {
      sanitized[headerName] = "[REDACTED]";
    }
  }

  return sanitized;
}
