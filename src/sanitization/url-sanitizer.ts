import { BASE_SENSITIVE_FIELDS } from "./sensitive-keys";
import { REDACTED_QUERY_VALUE } from "./query-sanitizer";

export const MALFORMED_URL_PLACEHOLDER = "[MALFORMED URL]";

/**
 * Redacts sensitive query parameters while retaining the URL's path and all
 * non-sensitive parameters. Absolute, protocol-relative and relative URLs
 * retain their original form. Invalid URLs return a fixed placeholder so the
 * original (which may contain a secret) cannot leak into logs.
 */
export function sanitizeUrl(
  value: string,
  extraSensitiveFields: string[] = [],
): string {
  if (typeof value !== "string" || value.length === 0 || /[\r\n]/.test(value)) {
    return MALFORMED_URL_PLACEHOLDER;
  }

  const absolute = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(value);
  const protocolRelative = value.startsWith("//");
  const base = "http://sanitizer.invalid";

  try {
    const parsed = new URL(value, base);
    const sensitiveFields = new Set(
      [...BASE_SENSITIVE_FIELDS, ...extraSensitiveFields].map((field) =>
        field.toLowerCase(),
      ),
    );

    const sanitizedParams = new URLSearchParams();
    for (const [key, parameterValue] of parsed.searchParams.entries()) {
      sanitizedParams.append(
        key,
        sensitiveFields.has(key.toLowerCase())
          ? REDACTED_QUERY_VALUE
          : parameterValue,
      );
    }
    parsed.search = sanitizedParams.toString();

    if (absolute) return parsed.toString();
    if (protocolRelative) {
      return `//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return MALFORMED_URL_PLACEHOLDER;
  }
}

/** Returns only the pathname of a URL, or the malformed-URL placeholder. */
export function getUrlPathname(value: string): string {
  if (value === MALFORMED_URL_PLACEHOLDER) return value;
  const sanitized = sanitizeUrl(value);
  if (sanitized === MALFORMED_URL_PLACEHOLDER) return sanitized;
  try {
    return new URL(sanitized, "http://sanitizer.invalid").pathname;
  } catch {
    return MALFORMED_URL_PLACEHOLDER;
  }
}
