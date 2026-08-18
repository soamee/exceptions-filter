import type { ActionCategory, BugfinderAction } from "./bugfinder-types";

const KNOWN_CATEGORIES: readonly ActionCategory[] = [
  "navigation",
  "click",
  "form",
  "input",
  "api",
  "error",
  "visibility",
  "custom",
];

const HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

/** Separators used by legacy clients to join actions into a single string. */
const LEGACY_ACTION_SEPARATOR = /\s*(?:,|→|->|\n)\s*/;

export interface TimelineEntry {
  /** 1-based position in chronological order. */
  index: number;
  action: BugfinderAction;
  /** "HH:MM:SS" in UTC, or "" when the action carries no usable timestamp. */
  time: string;
  timestampMs?: number;
  /** Milliseconds elapsed since the previous action, when it can be known. */
  gapMs?: number;
  /** Human-readable gap, e.g. "+2.4s". Empty when unknown. */
  gapLabel: string;
  /** Element id (or test id) of the element the user interacted with. */
  elementId?: string;
  /** Element id when present, otherwise the raw target selector. */
  targetLabel?: string;
  /** True for the newest action — the one right before the error. */
  isLast: boolean;
}

export function toMillis(timestamp?: string): number | undefined {
  if (!timestamp) return undefined;
  const ms = new Date(timestamp).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** UTC "HH:MM:SS" for a timestamp, or "" when it cannot be parsed. */
export function formatClock(timestamp?: string): string {
  const ms = toMillis(timestamp);
  if (ms === undefined) return "";
  return new Date(ms).toISOString().slice(11, 19);
}

/** Signed, compact gap between two consecutive actions ("+450ms", "+2.4s", "+1m 05s"). */
export function formatGap(ms?: number): string {
  const span = formatSpan(ms);
  return span ? `+${span}` : "";
}

/** Compact duration ("450ms", "2.4s", "1m 05s"). Empty for unknown values. */
export function formatSpan(ms?: number): string {
  if (ms === undefined || ms === null || Number.isNaN(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * Element identifier for an action: an explicit id, a test id, or the id
 * found inside a CSS-selector-ish target such as "button#save".
 */
export function resolveElementId(action: BugfinderAction): string | undefined {
  const explicit = action.targetId?.trim();
  if (explicit) return explicit.startsWith("#") ? explicit : `#${explicit}`;

  const testId = action.targetTestId?.trim();
  if (testId) return `[data-testid="${testId}"]`;

  const fromSelector = action.target?.match(/#([A-Za-z0-9_:.\-]+)/);
  if (fromSelector) return `#${fromSelector[1]}`;

  return undefined;
}

/** Element id when known, otherwise the raw target selector (truncated). */
export function describeTarget(action: BugfinderAction): string | undefined {
  const elementId = resolveElementId(action);
  if (elementId) return elementId;

  const target = action.target?.trim();
  if (!target) return undefined;
  return target.length > 48 ? `${target.slice(0, 45)}...` : target;
}

/**
 * Normalise a list of actions into chronological timeline entries, computing
 * the delay between each action and the previous one.
 *
 * Bugfinder envelopes arrive newest-first, so that is the default order.
 */
export function buildTimeline(
  actions: BugfinderAction[] | undefined,
  options: { order?: "newest-first" | "chronological" } = {},
): TimelineEntry[] {
  if (!actions || actions.length === 0) return [];

  const chronological =
    options.order === "chronological" ? [...actions] : [...actions].reverse();

  let previousMs: number | undefined;

  return chronological.map((action, idx) => {
    const timestampMs = toMillis(action.timestamp);

    // Prefer the real distance between timestamps; fall back to the elapsed
    // value the client reported when timestamps are missing or unusable.
    // The first entry has no predecessor in the buffer, so it can only use
    // whatever the client measured against the action it dropped.
    let gapMs: number | undefined;
    if (idx > 0 && timestampMs !== undefined && previousMs !== undefined) {
      const delta = timestampMs - previousMs;
      gapMs = delta >= 0 ? delta : undefined;
    } else if (action.elapsed !== undefined && action.elapsed !== null) {
      gapMs = action.elapsed;
    }

    if (timestampMs !== undefined) previousMs = timestampMs;

    return {
      index: idx + 1,
      action,
      time: formatClock(action.timestamp),
      timestampMs,
      gapMs,
      gapLabel: formatGap(gapMs),
      elementId: resolveElementId(action),
      targetLabel: describeTarget(action),
      isLast: idx === chronological.length - 1,
    };
  });
}

/** Total time covered by the timeline, in ms, when at least two timestamps exist. */
export function timelineSpanMs(entries: TimelineEntry[]): number | undefined {
  const stamps = entries
    .map((e) => e.timestampMs)
    .filter((ms): ms is number => ms !== undefined);
  if (stamps.length < 2) return undefined;
  const span = Math.max(...stamps) - Math.min(...stamps);
  return span >= 0 ? span : undefined;
}

function parseLegacyTimestamp(token: string): string | undefined {
  const raw = token.trim();
  if (!raw) return undefined;

  // Epoch milliseconds, e.g. "@1755500000000"
  if (/^\d{10,}$/.test(raw)) {
    const asNumber = Number(raw);
    const ms = raw.length <= 10 ? asNumber * 1000 : asNumber;
    return new Date(ms).toISOString();
  }

  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

/**
 * Parse the legacy flat `x-last-actions` string into structured actions.
 *
 * Entries are separated by "," / "→" / newlines, and each entry may carry
 * optional pipe-separated metadata tokens:
 *
 *   "Click: Save | [click] | #save-btn | @2026-08-12T10:00:05.000Z"
 *
 *   [token]  -> HTTP method when uppercase (GET/POST/...), category otherwise
 *   #token   -> element id
 *   @token   -> ISO date or epoch millis
 *
 * Unknown tokens are kept as part of the action label, so older clients that
 * only send free text keep rendering exactly as before.
 *
 * Returns actions in chronological order (oldest first).
 */
export function parseLegacyActions(raw: string): BugfinderAction[] {
  return raw
    .split(LEGACY_ACTION_SEPARATOR)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [head, ...tokens] = entry.split("|").map((part) => part.trim());

      const action: BugfinderAction = {
        action: head,
        category: "custom",
        timestamp: "",
      };
      const leftovers: string[] = [];

      for (const token of tokens) {
        if (!token) continue;

        const bracketed = token.match(/^\[(.+)\]$/);
        if (bracketed) {
          const value = bracketed[1].trim();
          if (HTTP_METHODS.has(value.toUpperCase())) {
            action.method = value.toUpperCase();
            continue;
          }
          const category = value.toLowerCase() as ActionCategory;
          if (KNOWN_CATEGORIES.includes(category)) {
            action.category = category;
            continue;
          }
          leftovers.push(token);
          continue;
        }

        if (token.startsWith("#") && token.length > 1) {
          action.targetId = token;
          continue;
        }

        if (token.startsWith("@")) {
          const timestamp = parseLegacyTimestamp(token.slice(1));
          if (timestamp) {
            action.timestamp = timestamp;
            continue;
          }
        }

        leftovers.push(token);
      }

      if (leftovers.length > 0) {
        action.action = [action.action, ...leftovers].filter(Boolean).join(" | ");
      }

      return action;
    });
}
