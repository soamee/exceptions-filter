import type { BugfinderAction, BugfinderEnvelope, ActionCategory } from "./bugfinder-types";
import { parseEnvelope } from "./envelope-parser";
import {
  buildTimeline,
  formatSpan,
  timelineSpanMs,
} from "./action-timeline";

const CATEGORY_ICONS: Record<ActionCategory, string> = {
  navigation: "&#128681;",
  click: "&#128070;",
  form: "&#128228;",
  input: "&#9998;",
  api: "&#127760;",
  error: "&#128165;",
  visibility: "&#128065;",
  custom: "&#9679;",
};

const CATEGORY_COLORS: Record<ActionCategory, string> = {
  navigation: "#2196F3",
  click: "#4CAF50",
  form: "#FF9800",
  input: "#9C27B0",
  api: "#00BCD4",
  error: "#F44336",
  visibility: "#607D8B",
  custom: "#795548",
};

/**
 * Format actions as HTML table rows for use inside an email template.
 * Actions are displayed in chronological order (oldest first).
 */
export function formatActionsAsTimeline(actions: BugfinderAction[]): string {
  if (!actions || actions.length === 0) return "";

  return buildTimeline(actions)
    .map((entry) => {
      const { action } = entry;
      const time = entry.time || "??:??:??";
      const icon = CATEGORY_ICONS[action.category] || CATEGORY_ICONS.custom;
      const method = action.method ? ` [${action.method}]` : "";
      const gapPart = entry.gapLabel
        ? ` <span style="color:#999;font-size:11px">${entry.gapLabel}</span>`
        : "";
      const targetPart = entry.targetLabel
        ? ` <span style="color:#999;font-size:11px;font-family:monospace">${entry.targetLabel}</span>`
        : "";

      return `<tr>
        <td style="padding:2px 8px;color:#999;font-size:12px;white-space:nowrap;font-family:monospace">${time}</td>
        <td style="padding:2px 4px;text-align:center">${icon}</td>
        <td style="padding:2px 8px;font-size:13px;color:${CATEGORY_COLORS[action.category] || "#333"}">${action.action}${method}${targetPart}${gapPart}</td>
      </tr>`;
    })
    .join("\n");
}

/**
 * Format actions as an MJML block with a table inside.
 */
export function formatTimelineMjml(actions: BugfinderAction[]): string {
  if (!actions || actions.length === 0) return "";

  const tableRows = formatActionsAsTimeline(actions);
  const span = formatSpan(timelineSpanMs(buildTimeline(actions)));
  const spanLabel = span ? `, ${span} span` : "";

  return `
    <mj-text font-size="16px" color="#424242" font-weight="bold">
      User Action Timeline (${actions.length} actions${spanLabel}):
    </mj-text>
    <mj-table cellpadding="0" cellspacing="0" width="100%">
      ${tableRows}
    </mj-table>`;
}

/**
 * Format the session summary (duration, action count, viewport, paths) as MJML.
 */
export function formatSessionSummaryMjml(envelope: BugfinderEnvelope): string {
  const { session, path, actions } = envelope;

  const parts: string[] = [];

  if (session.startedAt) {
    const start = new Date(session.startedAt);
    const lastAction = actions[0];
    const end = lastAction ? new Date(lastAction.timestamp) : start;
    const durationSec = Math.round((end.getTime() - start.getTime()) / 1000);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    parts.push(`Session duration: ${minutes}m ${seconds}s`);
  }

  parts.push(`Total actions before error: ${session.actionCount}`);

  if (session.viewport) {
    parts.push(`Viewport: ${session.viewport.w}x${session.viewport.h}`);
  }

  if (path.currentPath) {
    parts.push(`Current path: ${path.currentPath}`);
  }
  if (path.previousPath) {
    parts.push(`Previous path: ${path.previousPath}`);
  }

  return `
    <mj-text font-size="16px" color="#424242" font-weight="bold">
      Session Context:
    </mj-text>
    ${parts
      .map(
        (p) => `<mj-text color="#424242" font-size="13px">${p}</mj-text>`,
      )
      .join("\n")}`;
}

/**
 * Parse the x-bugfinder header (or accept an already-parsed envelope)
 * and return the complete MJML block: session summary + action timeline.
 */
export function formatEnvelopeToMjml(
  encodedOrEnvelope: string | BugfinderEnvelope,
): string {
  let envelope: BugfinderEnvelope | null;

  if (typeof encodedOrEnvelope === "string") {
    envelope = parseEnvelope(encodedOrEnvelope);
  } else {
    envelope = encodedOrEnvelope;
  }

  if (!envelope) return "";

  const sessionSummary = formatSessionSummaryMjml(envelope);
  const timeline = formatTimelineMjml(envelope.actions);

  return `
    <mj-divider border-width="1px" border-color="#ddd" />
    ${sessionSummary}
    ${timeline}`;
}

/**
 * Plain text version of the timeline (for logs, non-HTML contexts).
 */
export function formatActionsAsPlainText(actions: BugfinderAction[]): string {
  if (!actions || actions.length === 0) return "";

  return buildTimeline(actions)
    .map((entry) => {
      const { action } = entry;
      const time = entry.time || "??:??:??";
      const method = action.method ? ` [${action.method}]` : "";
      const target = entry.targetLabel ? ` ${entry.targetLabel}` : "";
      const gapPart = entry.gapLabel ? ` ${entry.gapLabel}` : "";
      return `${time} [${action.category}] ${action.action}${method}${target}${gapPart}`;
    })
    .join("\n");
}
