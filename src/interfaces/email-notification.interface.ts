export interface EmailNotificationAdapter {
  /**
   * Send an email notification for an error.
   * The package calls this with the rendered HTML body.
   */
  sendNotification(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void>;
}

export interface UserInfo {
  name?: string;
  email?: string;
  role?: string;
}

export interface EmailNotificationConfig {
  /** Enable email notifications */
  enabled: boolean;
  /** Email addresses to notify */
  toEmails: string[];
  /** Adapter to send emails (e.g. wraps MailerService) */
  adapter: EmailNotificationAdapter;
  /** Resolve user info from userId for display in email */
  userResolver?: (userId: string) => Promise<UserInfo | null>;
}
