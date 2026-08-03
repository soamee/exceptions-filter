export { botSkipPatterns } from "./bot-skip-patterns";
export { userErrorSkipPatterns } from "./user-error-skip-patterns";
export { attackSkipPatterns } from "./attack-skip-patterns";

import { botSkipPatterns } from "./bot-skip-patterns";
import { userErrorSkipPatterns } from "./user-error-skip-patterns";
import { attackSkipPatterns } from "./attack-skip-patterns";

export const allBaseSkipPatterns: RegExp[] = [
  ...botSkipPatterns,
  ...userErrorSkipPatterns,
  ...attackSkipPatterns,
];

export function shouldSkipException(
  message: string,
  extraPatterns: RegExp[] = [],
  knownRoutePrefixes: string[] = [],
): boolean {
  // If the error message references a known route, never skip it
  if (knownRoutePrefixes.length > 0 && isKnownRoute(message, knownRoutePrefixes)) {
    return false;
  }

  const patterns = [...allBaseSkipPatterns, ...extraPatterns];
  return patterns.some((pattern) => pattern.test(message));
}

/**
 * Extracts the path from a "Cannot METHOD /path" message and checks
 * if it starts with any of the known route prefixes.
 */
function isKnownRoute(message: string, prefixes: string[]): boolean {
  const match = message.match(/^Cannot \w+ (\/\S*)/);
  if (!match) return false;

  const path = match[1];
  return prefixes.some((prefix) => path.startsWith(prefix));
}
