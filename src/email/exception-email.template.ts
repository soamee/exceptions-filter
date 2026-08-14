import type { ErrorRecord, CreateErrorData } from "../interfaces/error-record.interface";
import type { UserInfo } from "../interfaces/email-notification.interface";

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

const formatUserActionsTimeline = (
  lastUserActions: string | undefined,
): string => {
  if (!lastUserActions || lastUserActions.trim() === "") return "";

  const actions = lastUserActions.split(",").map((a) => a.trim());

  const rows = actions
    .map((action, idx) => {
      const isLast = idx === actions.length - 1;
      const bgColor = isLast ? "#fff5f5" : "transparent";
      const borderColor = isLast ? "#dc3545" : "#e9ecef";
      const textColor = isLast ? "#dc3545" : "#495057";
      const fontWeight = isLast ? "bold" : "normal";

      return `<tr>
        <td style="padding:6px 8px;color:#adb5bd;font-size:11px;white-space:nowrap;font-family:monospace;width:30px;vertical-align:top;">${idx + 1}</td>
        <td style="padding:6px 8px;font-size:12px;color:${textColor};font-weight:${fontWeight};border-left:2px solid ${borderColor};background:${bgColor};">${escapeHtml(action)}</td>
      </tr>`;
    })
    .join("\n");

  return `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
      <tr>
        <td style="font-size:14px;font-weight:bold;color:#1a1a2e;padding:0 0 10px 0;">
          User Actions
          <span style="font-size:11px;color:#6c757d;font-weight:normal;margin-left:4px;">(${actions.length} actions)</span>
        </td>
      </tr>
    </table>
    <table cellpadding="0" cellspacing="0" width="100%">
      ${rows}
    </table>`;
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
          <pre style="background:#f8f9fa;color:#333;padding:10px;border-radius:4px;font-family:monospace;font-size:11px;margin:0 0 12px 0;white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(truncate(error.requestQuery, 500))}</pre>
          `
              : ""
          }

          ${
            error.requestBody
              ? `
          <div style="font-size:11px;font-weight:bold;color:#6c757d;text-transform:uppercase;padding-bottom:4px;">
            Request Body
          </div>
          <pre style="background:#f8f9fa;color:#333;padding:10px;border-radius:4px;font-family:monospace;font-size:11px;margin:0 0 12px 0;white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(truncate(error.requestBody, 500))}</pre>
          `
              : ""
          }

          ${
            error.requestHeaders
              ? `
          <div style="font-size:11px;font-weight:bold;color:#6c757d;text-transform:uppercase;padding-bottom:4px;">
            Request Headers
          </div>
          <pre style="background:#f8f9fa;color:#333;padding:10px;border-radius:4px;font-family:monospace;font-size:11px;margin:0;white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(truncate(error.requestHeaders, 400))}</pre>
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
