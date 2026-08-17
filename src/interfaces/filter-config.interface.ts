import { Request } from "express";
import { ErrorPersistenceAdapter } from "./error-persistence.interface";
import { ErrorRecord } from "./error-record.interface";
import { EmailNotificationConfig } from "./email-notification.interface";
import { FilterLogger } from "./logger.interface";
import type { CrawlerDetectionMetadata } from "../detection/crawler-detector";

export type NotificationSeverity = "info" | "warning" | "error";

export interface NotificationPolicyRule {
  /** Exact HTTP statuses matched by this rule. */
  statuses?: number[];
  severities?: NotificationSeverity[];
  /** Case-insensitive HTTP methods. */
  methods?: string[];
  /** Exact/prefix strings or regular expressions matched against the request path. */
  paths?: Array<string | RegExp>;
}

export interface SanitizedNotificationException {
  name: string;
  message: string;
  stack?: string;
}

export interface SanitizedNotificationRequest {
  method: string;
  path: string;
  ip?: string;
  headers: Record<string, unknown>;
  query: unknown;
  body: unknown;
}

export interface NotificationDecisionContext {
  /** A safe snapshot; the original exception/request objects are never exposed. */
  exception: SanitizedNotificationException;
  request: SanitizedNotificationRequest;
  record: ErrorRecord;
  status: number;
  severity: NotificationSeverity;
  crawler: CrawlerDetectionMetadata;
}

export interface NotificationPolicy {
  /** When present, at least one inclusion rule must match. */
  include?: NotificationPolicyRule[];
  /** Exclusions take precedence over includes and the custom decision. */
  exclude?: NotificationPolicyRule[];
  /** Final advanced decision, evaluated only after declarative rules allow notification. */
  decide?: (
    context: NotificationDecisionContext,
  ) => boolean | Promise<boolean>;
}

export interface ExceptionsFilterConfig {
  appName: string;
  appEnvironment: string;

  enableCrawlerDetection?: boolean;
  enableRequestOriginMetadata?: boolean;
  enableSentry?: boolean;
  enableThrottling?: boolean;
  enableDeduplication?: boolean;
  hideInternalErrors?: boolean;

  throttleMs?: number;
  deduplicationWindowHours?: number;
  skipMethods?: string[];

  extraSkipPatterns?: RegExp[];
  extraSensitiveFields?: string[];
  extraSensitiveHeaders?: string[];

  /** Route prefixes owned by this project (e.g. ['/api/v1', '/auth', '/webhooks']).
   *  Errors matching these prefixes are NEVER skipped, even if a skip pattern matches.
   *  This prevents generic bot/attack patterns from swallowing errors on your real routes.
   *  When autoDetectRoutes is enabled, detected routes are merged with these. */
  knownRoutePrefixes?: string[];

  /** When true, automatically detects registered NestJS routes at startup
   *  and adds them to the known route prefixes. Defaults to true. */
  autoDetectRoutes?: boolean;

  persistence?: ErrorPersistenceAdapter;

  onError?: (error: ErrorRecord) => Promise<void>;

  /** Optional filtering policy shared by onError and email notifications. */
  notificationPolicy?: NotificationPolicy;

  /** Transform the error message before it's used in response/logging/persistence.
   *  Useful for enriching messages like "File too large" with actual/max sizes. */
  transformMessage?: (
    message: string | string[],
    exception: unknown,
    request: Request,
  ) => string | string[];

  /** Transform the error response before sending to client.
   *  Useful for adding project-specific fields like "details". */
  transformResponse?: (
    response: Record<string, unknown>,
    exception: unknown,
    request: Request,
  ) => Record<string, unknown>;

  logger?: FilterLogger;

  /** Email notification config. When set, the package handles sending error emails. */
  emailNotification?: EmailNotificationConfig;
}

export const EXCEPTIONS_FILTER_CONFIG = Symbol("EXCEPTIONS_FILTER_CONFIG");
