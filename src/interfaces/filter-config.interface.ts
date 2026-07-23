import { Request } from "express";
import { ErrorPersistenceAdapter } from "./error-persistence.interface";
import { ErrorRecord } from "./error-record.interface";
import { FilterLogger } from "./logger.interface";

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

  persistence?: ErrorPersistenceAdapter;

  onError?: (error: ErrorRecord) => Promise<void>;

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
}

export const EXCEPTIONS_FILTER_CONFIG = Symbol("EXCEPTIONS_FILTER_CONFIG");
