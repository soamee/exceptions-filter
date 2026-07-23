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
): boolean {
  const patterns = [...allBaseSkipPatterns, ...extraPatterns];
  return patterns.some((pattern) => pattern.test(message));
}
