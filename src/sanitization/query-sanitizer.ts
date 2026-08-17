import { BASE_SENSITIVE_FIELDS } from "./sensitive-keys";

export const REDACTED_QUERY_VALUE = "******";

/**
 * Returns a recursively cloned query value with sensitive keys redacted.
 * Scalar values are returned unchanged and the input is never mutated.
 */
export function sanitizeQuery(
  query: unknown,
  extraSensitiveFields: string[] = [],
): unknown {
  const sensitiveFields = new Set(
    [...BASE_SENSITIVE_FIELDS, ...extraSensitiveFields].map((field) =>
      field.toLowerCase(),
    ),
  );

  return sanitizeQueryValue(query, sensitiveFields);
}

function sanitizeQueryValue(
  value: unknown,
  sensitiveFields: Set<string>,
): unknown {
  if (typeof value !== "object" || value === null) return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeQueryValue(item, sensitiveFields));
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    result[key] = sensitiveFields.has(key.toLowerCase())
      ? REDACTED_QUERY_VALUE
      : sanitizeQueryValue(child, sensitiveFields);
  }
  return result;
}

