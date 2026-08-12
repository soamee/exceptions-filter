import type { BugfinderEnvelope } from "./bugfinder-types";

/**
 * Parse the base64-encoded x-bugfinder header into a BugfinderEnvelope.
 * Returns null if the header is missing, empty, or malformed.
 */
export function parseEnvelope(encoded: string | undefined | null): BugfinderEnvelope | null {
  if (!encoded) return null;

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    return JSON.parse(decoded) as BugfinderEnvelope;
  } catch {
    return null;
  }
}
