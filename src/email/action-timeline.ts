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
  /** Page the action happened on, when it can be known. */
  pagePath?: string;
  /** Page the user came from, for actions that changed the page. */
  fromPath?: string;
  /** True when this action landed the user on a different page. */
  isPageChange: boolean;
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
 * Destination page of a navigation action: the `path` the client attached to
 * it, or the target parsed out of labels such as "Navigate to /checkout".
 *
 * Returns undefined for actions that did not move the user.
 */
export function navigationTarget(action: BugfinderAction): string | undefined {
  if (action.category !== "navigation") return undefined;

  const path = action.path?.trim();
  if (path) return path;

  const label = action.action?.trim() ?? "";
  const match = label.match(
    /^(?:navigate(?:d)?\s+(?:to|a)|navigation|go(?:to)?|screen|route)\s*[:>-]?\s*(\S+)/i,
  );
  return match ? match[1] : undefined;
}

/**
 * Infer whether a list of actions is newest-first or already chronological.
 *
 * Bugfinder clients buffer newest-first, so that stays the assumption when
 * timestamps cannot settle it (legacy payloads carry none).
 */
export function detectOrder(
  actions: BugfinderAction[],
): "newest-first" | "chronological" {
  const stamps = actions
    .map((action) => toMillis(action.timestamp))
    .filter((ms): ms is number => ms !== undefined);

  for (let i = 1; i < stamps.length; i++) {
    if (stamps[i] < stamps[i - 1]) return "newest-first";
    if (stamps[i] > stamps[i - 1]) return "chronological";
  }

  return "newest-first";
}

/**
 * Normalise a list of actions into chronological timeline entries, computing
 * the delay between each action and the previous one.
 *
 * Bugfinder envelopes arrive newest-first, so that is the default order;
 * pass "auto" to infer the order from the timestamps instead.
 */
export function buildTimeline(
  actions: BugfinderAction[] | undefined,
  options: { order?: "newest-first" | "chronological" | "auto" } = {},
): TimelineEntry[] {
  if (!actions || actions.length === 0) return [];

  const order =
    options.order === "auto" ? detectOrder(actions) : options.order;
  const chronological =
    order === "chronological" ? [...actions] : [...actions].reverse();

  let previousMs: number | undefined;
  let currentPage: string | undefined;

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

    // Track which page each action happened on so the timeline can show the
    // page the user came from and where they moved to. Navigation actions
    // carry the destination; every other action inherits the page it ran on.
    const destination = navigationTarget(action);
    const reportedPage = action.path?.trim() || undefined;
    let fromPath: string | undefined;
    let isPageChange = false;

    if (destination && destination !== currentPage) {
      fromPath = currentPage;
      isPageChange = currentPage !== undefined;
      currentPage = destination;
    } else if (!destination && reportedPage && reportedPage !== currentPage) {
      fromPath = currentPage;
      isPageChange = currentPage !== undefined;
      currentPage = reportedPage;
    }

    return {
      index: idx + 1,
      action,
      time: formatClock(action.timestamp),
      timestampMs,
      gapMs,
      gapLabel: formatGap(gapMs),
      elementId: resolveElementId(action),
      targetLabel: describeTarget(action),
      pagePath: currentPage,
      fromPath,
      isPageChange,
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

/**
 * The pages the user went through, oldest first and without repeats, e.g.
 * ["/en", "/", "/checkout"]. Empty when no action carries page information.
 */
export function timelineJourney(entries: TimelineEntry[]): string[] {
  const pages: string[] = [];
  for (const entry of entries) {
    const page = entry.pagePath;
    if (page && page !== pages[pages.length - 1]) pages.push(page);
  }
  return pages;
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
 * Actions are returned in the order they appeared in the header. Bugfinder
 * clients emit them newest-first; use buildTimeline's "auto" order to let the
 * timeline settle it from the timestamps when they are present.
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

        // Clients send the HTTP verb as a bare token ("SUBMIT | POST"),
        // older ones bracketed it. Accept both so it never leaks into the label.
        if (HTTP_METHODS.has(token.toUpperCase())) {
          action.method = token.toUpperCase();
          continue;
        }

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

        if (token.startsWith("@testid:") && token.length > 8) {
          action.targetTestId = token.slice(8);
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
