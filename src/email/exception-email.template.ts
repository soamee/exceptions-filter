import type { ErrorRecord, CreateErrorData } from "../interfaces/error-record.interface";
import type { UserInfo } from "../interfaces/email-notification.interface";
import { parseEnvelope } from "./envelope-parser";
import type { BugfinderEnvelope } from "./bugfinder-types";
import type { TimelineEntry } from "./action-timeline";
import {
  buildTimeline,
  formatSpan,
  parseLegacyActions,
  timelineSpanMs,
} from "./action-timeline";

export interface RenderExceptionEmailParams {
  error: ErrorRecord & CreateErrorData;
  appName: string;
  appModuleName?: string;
  appEnvironment: string;
  user?: UserInfo | null;
  createdAt: string;
}

const truncate = (str: string | undefined, maxLen: number): string => {
  if (!str) return "";
  return str.length > maxLen ? str.substring(0, maxLen) + "..." : str;
};

const prettyJson = (str: string | undefined, maxLen: number): string => {
  if (!str) return "";
  try {
    const parsed = JSON.parse(str);
    const pretty = JSON.stringify(parsed, null, 2);
    return truncate(pretty, maxLen);
  } catch {
    return truncate(str, maxLen);
  }
};

const formatStackTrace = (
  trace: string | undefined,
  maxLines: number = 10,
): string => {
  if (!trace) return "";
  return trace
    .split("\n")
    .slice(0, maxLines)
    .map((line) => (line.length > 140 ? line.substring(0, 137) + "..." : line))
    .join("\n");
};

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const CONTROL_OR_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/;

const decodeBase64 = (str: string): string => {
  const compact = str.replace(/\s+/g, "");
  if (compact.length === 0 || compact.length % 4 !== 0) return str;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return str;

  try {
    const buffer = Buffer.from(compact, "base64");
    // Non-canonical base64 means the value was plain text that happens to
    // use only base64 characters — keep it as-is.
    if (buffer.toString("base64") !== compact) return str;

    const decoded = buffer.toString("utf-8");
    // Accented text is expected (action labels are localised); control
    // characters or replacement chars mean this was not really base64.
    if (!decoded || CONTROL_OR_INVALID.test(decoded)) return str;
    return decoded;
  } catch {
    return str;
  }
};

const ACTION_ICONS: Record<string, string> = {
  navigation: "&#128681;",
  click: "&#128070;",
  form: "&#128228;",
  input: "&#9998;",
  api: "&#127760;",
  error: "&#128165;",
  visibility: "&#128065;",
  custom: "&#9679;",
};

const formatActionRows = (entries: TimelineEntry[], showTime: boolean): string =>
  entries
    .map((entry) => {
      const { action } = entry;
      const method = action.method
        ? ` <strong>[${escapeHtml(action.method)}]</strong>`
        : "";
      const target = entry.targetLabel
        ? ` <span style="color:#868e96;font-size:10px;font-family:monospace;">${escapeHtml(entry.targetLabel)}</span>`
        : "";
      const timeCell = showTime
        ? `<td style="width:62px;padding:7px 6px;color:#868e96;font:11px monospace;vertical-align:top;white-space:nowrap;">
        ${entry.time || "--:--:--"}
        ${entry.gapLabel ? `<br/><span style="color:#adb5bd;font-size:10px;">${entry.gapLabel}</span>` : ""}
      </td>`
        : "";
      const inlineGap =
        !showTime && entry.gapLabel
          ? ` <span style="color:#868e96;font-size:10px;">${entry.gapLabel}</span>`
          : "";

      return `<tr>
      <td style="width:26px;padding:7px 4px;color:#adb5bd;font:11px monospace;vertical-align:top;">${entry.index}</td>
      ${timeCell}
      <td style="width:22px;padding:6px 2px;text-align:center;vertical-align:top;">${ACTION_ICONS[action.category] || ACTION_ICONS.custom}</td>
      <td style="padding:7px 8px;border-left:2px solid ${entry.isLast ? "#dc3545" : "#dee2e6"};background:${entry.isLast ? "#fff5f5" : "transparent"};color:${entry.isLast ? "#dc3545" : "#495057"};font-size:12px;font-weight:${entry.isLast ? "bold" : "normal"};">${escapeHtml(action.action)}${method}${target}${inlineGap}</td>
    </tr>`;
    })
    .join("\n");

const formatTimelineTable = (
  entries: TimelineEntry[],
  title: string,
  pathHtml: string,
): string => {
  const showTime = entries.some((entry) => entry.time !== "");
  const span = formatSpan(timelineSpanMs(entries));
  const spanLabel = span ? ` &middot; ${span} span` : "";

  return `
    <div style="font-size:14px;font-weight:bold;color:#1a1a2e;padding-bottom:4px;">
      ${title}
      <span style="font-size:11px;color:#6c757d;font-weight:normal;margin-left:4px;">(${entries.length} actions${spanLabel})</span>
    </div>
    ${pathHtml}
    <table cellpadding="0" cellspacing="0" width="100%">${formatActionRows(entries, showTime)}</table>`;
};

const formatStructuredTimeline = (envelope: BugfinderEnvelope): string => {
  const entries = buildTimeline(envelope.actions);

  const path = envelope.path?.currentPath
    ? `<div style="padding-bottom:10px;color:#6c757d;font-size:11px;">Current screen: <strong>${escapeHtml(envelope.path.currentPath)}</strong>${envelope.path.previousPath ? ` &middot; Previous: ${escapeHtml(envelope.path.previousPath)}` : ""}</div>`
    : "";

  return formatTimelineTable(entries, "User Action Timeline", path);
};

const formatUserActionsTimeline = (
  lastUserActions: string | undefined,
): string => {
  if (!lastUserActions || lastUserActions.trim() === "") return "";

  // New bugfinder clients send a base64-encoded structured envelope. Render
  // its actions as an actual chronological timeline rather than showing the
  // encoded payload as a single action.
  const envelope = parseEnvelope(lastUserActions);
  if (envelope?.actions && Array.isArray(envelope.actions)) {
    return formatStructuredTimeline(envelope);
  }

  // Decode base64 if needed (x-last-actions header is base64-encoded) and
  // parse the flat format, which may carry category, element id and
  // timestamp tokens per action.
  const decoded = decodeBase64(lastUserActions);
  const entries = buildTimeline(parseLegacyActions(decoded), {
    order: "chronological",
  });
  if (entries.length === 0) return "";

  return formatTimelineTable(entries, "User Actions", "");
};

/**
 * Render an exception notification email as plain HTML with inline styles.
 * No MJML dependency — outputs a self-contained HTML document suitable for email clients.
 */
export function renderExceptionEmail(params: RenderExceptionEmailParams): {
  subject: string;
  html: string;
} {
  const { error, appName, appModuleName, appEnvironment, user, createdAt } =
    params;

  const subject = `[ERROR] ${appName} (${appEnvironment}): ${truncate(error.exceptionMessage, 80)}`;

  const moduleName = appModuleName || "api";
  const userName = user?.name || "Anonymous";
  const userEmail = user?.email || "";
  const userRole = user?.role || error.userRole || "";

  // --- Build sections ---

  const severityBanner = `
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#dc3545;">
      <tr>
        <td style="padding:12px 24px;" width="75%">
          <div style="color:#ffffff;font-size:14px;font-weight:bold;font-family:Arial,sans-serif;">
            ERROR in ${escapeHtml((appEnvironment || "UNKNOWN").toUpperCase())}
          </div>
          <div style="color:rgba(255,255,255,0.8);font-size:11px;font-family:Arial,sans-serif;padding-top:4px;">
            ${escapeHtml(appName || "App")} &middot; ${escapeHtml(moduleName)} &middot; ${escapeHtml(createdAt || "")}
          </div>
        </td>
        <td style="padding:12px 24px;text-align:right;" width="25%">
          <span style="display:inline-block;background:rgba(255,255,255,0.2);color:#fff;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:bold;font-family:Arial,sans-serif;">
            ${escapeHtml(moduleName)}
          </span>
        </td>
      </tr>
    </table>`;

  const errorMessage = `
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;">
      <tr>
        <td style="padding:20px 24px 12px 24px;">
          <div style="font-size:18px;font-weight:bold;color:#1a1a2e;font-family:Arial,sans-serif;padding-bottom:8px;">
            ${escapeHtml(error.exceptionMessage)}
          </div>
          ${
            error.additionalMessages
              ? `<div style="font-size:13px;color:#6c757d;font-family:Arial,sans-serif;">
                  ${escapeHtml(error.additionalMessages)}
                </div>`
              : ""
          }
        </td>
      </tr>
    </table>`;

  const quickContext = `
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;">
      <tr>
        <td style="padding:0 24px 16px 24px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width:33%;padding:12px;background:#f8f9fa;border-radius:6px 0 0 6px;border-right:2px solid #fff;vertical-align:top;font-family:Arial,sans-serif;">
                <strong style="font-size:10px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px;">Who</strong><br/>
                <span style="font-size:14px;color:#1a1a2e;font-weight:600;">${escapeHtml(userName)}</span><br/>
                ${userEmail ? `<span style="font-size:11px;color:#6c757d;">${escapeHtml(userEmail)}</span><br/>` : ""}
                ${userRole ? `<span style="display:inline-block;margin-top:4px;background:#e8dff5;color:#4B3375;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:bold;">${escapeHtml(userRole)}</span>` : ""}
              </td>
              <td style="width:34%;padding:12px;background:#f8f9fa;border-right:2px solid #fff;vertical-align:top;font-family:Arial,sans-serif;">
                <strong style="font-size:10px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px;">Endpoint</strong><br/>
                ${error.requestMethod ? `<span style="font-size:14px;color:#1a1a2e;font-family:monospace;font-weight:600;">${escapeHtml(error.requestMethod)}</span> ` : ""}
                <span style="font-size:12px;color:#1a1a2e;font-family:monospace;">${escapeHtml(truncate(error.requestUrl, 40))}</span>
                ${error.requestPath ? `<br/><span style="font-size:11px;color:#6c757d;">Frontend: ${escapeHtml(truncate(error.requestPath, 30))}</span>` : ""}
              </td>
              <td style="width:33%;padding:12px;background:#f8f9fa;border-radius:0 6px 6px 0;vertical-align:top;font-family:Arial,sans-serif;">
                <strong style="font-size:10px;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px;">Client</strong><br/>
                ${error.clientIp ? `<span style="font-size:11px;color:#6c757d;font-family:monospace;">${escapeHtml(error.clientIp)}</span><br/>` : ""}
                ${error.clientVersion ? `<span style="font-size:11px;color:#6c757d;">${escapeHtml(error.clientVersion)}</span>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  const screenContext =
    error.requestContext
      ? `
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;">
      <tr>
        <td style="padding:0 24px 8px 24px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:6px 12px;background:#f0f7ff;border-radius:4px;font-size:12px;color:#495057;font-family:Arial,sans-serif;">
                <strong>Screen Context:</strong> ${escapeHtml(error.requestContext)}
                ${error.actionElapsedMs ? ` &middot; <strong>Action elapsed:</strong> ${(error.actionElapsedMs / 1000).toFixed(1)}s` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`
      : "";

  const divider = `
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;">
      <tr>
        <td style="padding:0 24px;">
          <div style="border-top:1px solid #e9ecef;"></div>
        </td>
      </tr>
    </table>`;

  const userActionsHtml = error.lastUserActions
    ? `
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;">
      <tr>
        <td style="padding:12px 24px 16px 24px;font-family:Arial,sans-serif;">
          ${formatUserActionsTimeline(error.lastUserActions)}
        </td>
      </tr>
    </table>
    ${divider}`
    : "";

  const stackTraceHtml = error.stackTrace
    ? `
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;">
      <tr>
        <td style="padding:16px 24px;font-family:Arial,sans-serif;">
          <div style="font-size:14px;font-weight:bold;color:#1a1a2e;padding-bottom:4px;">
            Stack Trace
            <span style="font-size:11px;color:#6c757d;font-weight:normal;">(first 10 frames)</span>
          </div>
          <pre style="background:#1e1e2e;color:#cdd6f4;padding:14px;border-radius:6px;font-family:'Courier New',monospace;font-size:11px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;margin:0;">${escapeHtml(formatStackTrace(error.stackTrace))}</pre>
        </td>
      </tr>
    </table>
    ${divider}`
    : "";

  const hasRequestDetails =
    error.requestHeaders || error.requestQuery || error.requestBody;
  const requestDetailsHtml = hasRequestDetails
    ? `
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;">
      <tr>
        <td style="padding:16px 24px;font-family:Arial,sans-serif;">
          <div style="font-size:14px;font-weight:bold;color:#1a1a2e;padding-bottom:12px;">
            Request Details
            <span style="font-size:11px;color:#6c757d;font-weight:normal;">(preview)</span>
          </div>

          ${
            error.requestQuery
              ? `
          <div style="font-size:11px;font-weight:bold;color:#6c757d;text-transform:uppercase;padding-bottom:4px;">
            Query Parameters
          </div>
          <pre style="background:#f8f9fa;color:#333;padding:10px;border-radius:4px;font-family:monospace;font-size:11px;margin:0 0 12px 0;white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(prettyJson(error.requestQuery, 800))}</pre>
          `
              : ""
          }

          ${
            error.requestBody
              ? `
          <div style="font-size:11px;font-weight:bold;color:#6c757d;text-transform:uppercase;padding-bottom:4px;">
            Request Body
          </div>
          <pre style="background:#f8f9fa;color:#333;padding:10px;border-radius:4px;font-family:monospace;font-size:11px;margin:0 0 12px 0;white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(prettyJson(error.requestBody, 800))}</pre>
          `
              : ""
          }

          ${
            error.requestHeaders
              ? `
          <div style="font-size:11px;font-weight:bold;color:#6c757d;text-transform:uppercase;padding-bottom:4px;">
            Request Headers
          </div>
          <pre style="background:#f8f9fa;color:#333;padding:10px;border-radius:4px;font-family:monospace;font-size:11px;margin:0;white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(prettyJson(error.requestHeaders, 800))}</pre>
          `
              : ""
          }
        </td>
      </tr>
    </table>
    ${divider}`
    : "";

  const userAgentHtml = error.userAgent
    ? `
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;">
      <tr>
        <td style="padding:12px 24px 16px 24px;font-family:Arial,sans-serif;">
          <div style="font-size:11px;color:#adb5bd;">
            <strong>User Agent:</strong> ${escapeHtml(truncate(error.userAgent, 200))}
          </div>
        </td>
      </tr>
    </table>`
    : "";

  const footer = `
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8f9fa;">
      <tr>
        <td style="padding:16px 24px;text-align:center;font-family:Arial,sans-serif;">
          <div style="font-size:12px;color:#6c757d;">
            Automated error notification from ${escapeHtml(appName || "App")} bugfinder
          </div>
        </td>
      </tr>
    </table>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 0;">
        <table cellpadding="0" cellspacing="0" width="600" style="max-width:600px;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          ${severityBanner}
          ${errorMessage}
          ${quickContext}
          ${screenContext}
          ${divider}
          ${userActionsHtml}
          ${stackTraceHtml}
          ${requestDetailsHtml}
          ${userAgentHtml}
          ${footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
