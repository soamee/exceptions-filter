import type { EmailNotificationAdapter, UserInfo } from "../interfaces/email-notification.interface";
import type { ErrorRecord, CreateErrorData } from "../interfaces/error-record.interface";
import { renderExceptionEmail } from "./exception-email.template";

export interface ResendExceptionEmailParams {
  /** The error record from the database */
  error: ErrorRecord & Partial<CreateErrorData>;
  /** App name for the email subject/header */
  appName: string;
  /** App environment (development, staging, production) */
  appEnvironment: string;
  /** App module name */
  appModuleName?: string;
  /** Recipient email addresses */
  toEmails: string[];
  /** The adapter to send the email through */
  adapter: EmailNotificationAdapter;
  /** Resolved user info (if available) */
  user?: UserInfo | null;
}

/**
 * Re-send an exception notification email for an existing error record.
 * Uses the same template as the automatic error notification.
 *
 * Use this in ErrorExceptionsMessageService to replace local templates:
 *
 * ```ts
 * import { resendExceptionEmail } from '@soamee/exceptions-filter';
 *
 * await resendExceptionEmail({
 *   error: errorRecord,
 *   appName: this.config.appName,
 *   appEnvironment: this.config.appEnvironment,
 *   toEmails: ['dev@example.com'],
 *   adapter: this.emailAdapter,
 *   user: resolvedUser,
 * });
 * ```
 */
export async function resendExceptionEmail(
  params: ResendExceptionEmailParams,
): Promise<void> {
  const { error, appName, appEnvironment, appModuleName, toEmails, adapter, user } =
    params;

  const createdAt = error.createdAt instanceof Date
    ? error.createdAt.toISOString()
    : String(error.createdAt);

  const { subject, html } = renderExceptionEmail({
    error: error as ErrorRecord & CreateErrorData,
    appName,
    appModuleName,
    appEnvironment,
    user,
    createdAt,
  });

  for (const to of toEmails) {
    await adapter.sendNotification({
      to,
      subject,
      html,
      action: "bugfinder-exception-resend",
    });
  }
}
