import { BASE_SENSITIVE_FIELDS } from "./sensitive-keys";

export function sanitizeBody(
  data: unknown,
  extraSensitiveFields: string[] = [],
): unknown {
  const sensitiveFieldsLower = [
    ...BASE_SENSITIVE_FIELDS,
    ...extraSensitiveFields,
  ].map((f) => f.toLowerCase());

  return sanitizeRecursive(data, sensitiveFieldsLower);
}

function sanitizeRecursive(
  data: unknown,
  sensitiveFieldsLower: string[],
): unknown {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeRecursive(item, sensitiveFieldsLower));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (sensitiveFieldsLower.includes(key.toLowerCase())) {
      sanitized[key] = "******";
    } else {
      sanitized[key] = sanitizeRecursive(value, sensitiveFieldsLower);
    }
  }

  return sanitized;
}
