import {
  Catch,
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { ExceptionFilter, ArgumentsHost } from "@nestjs/common";
import { Request, Response } from "express";
import {
  ExceptionsFilterConfig,
  EXCEPTIONS_FILTER_CONFIG,
} from "./interfaces/filter-config.interface";
import type { ErrorResponse } from "./interfaces/error-response.interface";
import type { FilterLogger } from "./interfaces/logger.interface";
import { sanitizeHeaders } from "./sanitization";
import { sanitizeBody } from "./sanitization";
import { shouldSkipException } from "./skip-patterns";
import { detectCrawler, extractRequestOrigin } from "./detection";

let ForbiddenError: any;
try {
  ForbiddenError = require("@casl/ability").ForbiddenError;
} catch {}

let Sentry: any;
try {
  Sentry = require("@sentry/nestjs");
} catch {}

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger: FilterLogger;
  private readonly recentErrors = new Map<string, Date>();

  constructor(
    @Inject(EXCEPTIONS_FILTER_CONFIG)
    private readonly config: ExceptionsFilterConfig,
  ) {
    if (config.logger) {
      this.logger = config.logger;
    } else {
      const nestLogger = new Logger("AllExceptionsFilter");
      this.logger = {
        error: (context: string, message: string) =>
          nestLogger.error(message, context),
        warn: (context: string, message: string) =>
          nestLogger.warn(message, context),
        info: (context: string, message: string) =>
          nestLogger.log(message, context),
        debug: (context: string, message: string) =>
          nestLogger.debug(message, context),
      };
    }
  }

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const isForbiddenError =
      ForbiddenError && exception instanceof ForbiddenError;

    const status = isHttpException
      ? exception.getStatus()
      : isForbiddenError
        ? HttpStatus.FORBIDDEN
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = this.extractMessage(exception);

    // Allow projects to transform the message (e.g., enrich "File too large" with sizes)
    if (this.config.transformMessage) {
      message = this.config.transformMessage(message, exception, request);
    }

    const error = isHttpException
      ? this.extractErrorField(exception as HttpException)
      : isForbiddenError
        ? (exception as Error).name
        : "Internal error occurred";

    // Sentry capture for unhandled 500s
    if (
      status === HttpStatus.INTERNAL_SERVER_ERROR &&
      !isHttpException &&
      this.config.enableSentry &&
      Sentry
    ) {
      try {
        Sentry.captureException(exception);
      } catch {
        // ignore sentry errors
      }
    }

    // Check skipMethods → early return
    const skipMethods = this.config.skipMethods ?? ["HEAD", "MKCOL"];
    const method = request.method ?? "";
    if (skipMethods.includes(method)) {
      const clientMessage = this.getClientMessage(
        status,
        message,
        isHttpException,
      );
      const errorResponse = this.getErrorResponse({
        status,
        error: error,
        request,
        message: clientMessage,
      });
      response.status(status).json(errorResponse);
      return;
    }

    // Apply hideInternalErrors → generic message for unhandled 500s
    const clientMessage = this.getClientMessage(
      status,
      message,
      isHttpException,
    );

    // Throttle check
    const ip = request.ip ?? "unknown";
    const throttleKey = `${ip}:${Array.isArray(message) ? message.join(",") : message}`;
    const throttleMs = this.config.throttleMs ?? 1000;
    const isThrottled = this.isThrottled(throttleKey, throttleMs);

    // Log to console
    const messageStr = Array.isArray(message) ? message.join(", ") : message;
    const logMessage = `[${this.config.appName}] ${method} ${request.url} - ${status} - ${messageStr}`;
    if (status >= 500) {
      this.logger.error("AllExceptionsFilter", logMessage);
    } else if (status >= 400) {
      this.logger.warn("AllExceptionsFilter", logMessage);
    } else {
      this.logger.info("AllExceptionsFilter", logMessage);
    }

    // Check skipPatterns → skip DB + notification if match
    const shouldSkip = shouldSkipException(
      messageStr,
      this.config.extraSkipPatterns,
    );

    let errorId: string | undefined;
    let persistedRecord: import("./interfaces/error-record.interface").ErrorRecord | null = null;
    let isNewRecord = false;
    let isCrawler = false;

    if (!shouldSkip && this.config.persistence) {
      // Throttle: if throttled, skip DB persistence
      if (this.config.enableThrottling && isThrottled) {
        // Skip persistence for throttled errors
      } else {
        // Mark as recent
        if (this.config.enableThrottling) {
          this.recentErrors.set(throttleKey, new Date());
          this.cleanupRecentErrors();
        }

        // Persistence: dedup check → create if new
        const result = await this.logErrorToDatabase({
          exception,
          request,
          message: messageStr,
          status,
          error,
        });
        if (result) {
          errorId = result.record.id;
          persistedRecord = result.record;
          isNewRecord = result.isNew;
        }
      }
    }

    // Crawler detection
    if (this.config.enableCrawlerDetection) {
      const crawlerInfo = detectCrawler(request);
      isCrawler = crawlerInfo.isCrawler;
    }

    // onError callback — only for newly created records, not duplicates
    if (
      !shouldSkip &&
      isNewRecord &&
      persistedRecord &&
      this.config.onError &&
      !isCrawler &&
      !this.isFromExceptionController(request.url)
    ) {
      try {
        await this.config.onError(persistedRecord);
      } catch (callbackError) {
        this.logger.error(
          "AllExceptionsFilter",
          `onError callback failed: ${callbackError}`,
        );
      }
    }

    // Return sanitized ErrorResponse
    const errorResponse = this.getErrorResponse({
      status,
      error: error,
      request,
      message: clientMessage,
      errorId,
    });

    response.status(status).json(errorResponse);
  }

  private extractErrorField(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === "object" && response !== null) {
      const resp = response as Record<string, unknown>;
      if (typeof resp.error === "string") {
        return resp.error;
      }
    }
    return exception.message;
  }

  private extractMessage(exception: unknown): string | string[] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === "object" && response !== null) {
        const resp = response as Record<string, unknown>;
        if (Array.isArray(resp.message)) {
          return resp.message as string[];
        }
        if (typeof resp.message === "string") {
          return resp.message;
        }
      }
      return exception.message;
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    if (typeof exception === "string") {
      return exception;
    }

    return "Unknown error occurred";
  }

  private getClientMessage(
    status: number,
    message: string | string[],
    isHttpException: boolean,
  ): string | string[] {
    if (
      status === HttpStatus.INTERNAL_SERVER_ERROR &&
      !isHttpException &&
      this.config.hideInternalErrors !== false
    ) {
      return "Internal server error";
    }
    return message;
  }

  private getErrorResponse(params: {
    status: number;
    error: string;
    request: Request;
    message: string | string[];
    errorId?: string;
  }): ErrorResponse {
    const { status, error, request, message, errorId } = params;
    const response: ErrorResponse = {
      statusCode: status,
      error,
      path: request.url,
      method: request.method,
      timestamp: new Date(),
      message,
    };

    if (errorId) {
      response.errorId = errorId;
    }

    return response;
  }

  private extractFileName(exception: unknown): string | undefined {
    if (!(exception instanceof Error) || !exception.stack) {
      return undefined;
    }

    const lines = exception.stack.split("\n");
    for (let i = 1; i < lines.length; i++) {
      const match = lines[i].match(/\(([^)]+)\)/);
      if (match) {
        return match[1];
      }
      const atMatch = lines[i].match(/at\s+(.+)/);
      if (atMatch) {
        return atMatch[1].trim();
      }
    }

    return undefined;
  }

  private async logErrorToDatabase(params: {
    exception: unknown;
    request: Request;
    message: string;
    status: number;
    error: string;
  }): Promise<{ record: import("./interfaces/error-record.interface").ErrorRecord; isNew: boolean } | null> {
    const { exception, request, message } = params;
    const persistence = this.config.persistence;
    if (!persistence) return null;

    try {
      // Deduplication check (only when enableDeduplication is not explicitly false)
      if (this.config.enableDeduplication !== false) {
        const deduplicationWindowHours =
          this.config.deduplicationWindowHours ?? 24;
        const since = new Date();
        since.setHours(since.getHours() - deduplicationWindowHours);

        const existing = await persistence.findDuplicate({
          exceptionMessage: message,
          stackTrace:
            exception instanceof Error ? exception.stack : undefined,
          requestMethod: request.method,
          requestUrl: request.url,
          requestBody: request.body
            ? JSON.stringify(
                sanitizeBody(request.body, this.config.extraSensitiveFields),
              )
            : undefined,
          since,
        });

        if (existing) {
          return { record: existing, isNew: false };
        }
      }

      // Create new error record
      const sanitizedHeaders = sanitizeHeaders(
        request.headers,
        this.config.extraSensitiveHeaders,
      );
      const sanitizedBody = sanitizeBody(
        request.body,
        this.config.extraSensitiveFields,
      );

      const user = (request as any).user;
      const file = this.extractFileName(exception);

      // Wire up request origin metadata when enabled
      let additionalMessages: string | undefined;
      if (this.config.enableRequestOriginMetadata !== false) {
        const originMetadata = extractRequestOrigin(request);
        additionalMessages = JSON.stringify(originMetadata);
      }

      const created = await persistence.create({
        exceptionMessage: message,
        file,
        triggeredById: user?.id ?? user?.sub,
        stackTrace:
          exception instanceof Error ? exception.stack : undefined,
        requestMethod: request.method,
        requestUrl: request.url,
        requestHeaders: JSON.stringify(sanitizedHeaders),
        requestQuery: request.query
          ? JSON.stringify(request.query)
          : undefined,
        requestBody: sanitizedBody
          ? JSON.stringify(sanitizedBody)
          : undefined,
        additionalMessages,
        userRole: user?.role ?? user?.roles?.join(","),
        userAgent: this.getHeaderValue(request.headers["user-agent"]),
        clientIp: request.ip ?? undefined,
        clientVersion: this.getHeaderValue(
          request.headers["x-client-version"],
        ),
        appModuleName: this.config.appName,
        correlationId: this.getHeaderValue(
          request.headers["x-correlation-id"] ??
            request.headers["x-request-id"],
        ),
        requestPath: request.url,
        requestContext: this.formatRequestContext(
          this.extractScreenContext(request.headers),
        ),
        lastUserActions: this.extractLastActions(request.headers),
        actionElapsedMs: this.extractActionElapsedMs(request.headers),
      });

      return { record: created, isNew: true };
    } catch (dbError) {
      this.logger.error(
        "AllExceptionsFilter",
        `Failed to persist error: ${dbError}`,
      );
      return null;
    }
  }

  private isThrottled(key: string, throttleMs: number): boolean {
    const lastOccurrence = this.recentErrors.get(key);
    if (!lastOccurrence) return false;
    return Date.now() - lastOccurrence.getTime() < throttleMs;
  }

  private cleanupRecentErrors(): void {
    const throttleMs = this.config.throttleMs ?? 1000;
    const now = Date.now();
    for (const [key, date] of this.recentErrors.entries()) {
      if (now - date.getTime() > throttleMs * 2) {
        this.recentErrors.delete(key);
      }
    }
  }

  private isFromExceptionController(url: string): boolean {
    const exceptionPaths = [
      "/error-exceptions-messages",
      "/exceptions",
      "/errors",
    ];
    return exceptionPaths.some((path) => url.startsWith(path));
  }

  private getHeaderValue(
    header?: string | string[],
  ): string | undefined {
    if (Array.isArray(header)) {
      return header[0] || undefined;
    }
    return header || undefined;
  }

  private extractScreenContext(
    headers: Record<string, string | string[] | undefined>,
  ): string | undefined {
    const screen = this.getHeaderValue(headers["x-screen-context"]);
    return screen;
  }

  private formatRequestContext(
    context: string | undefined,
  ): string | undefined {
    return context;
  }

  private extractLastActions(
    headers: Record<string, string | string[] | undefined>,
  ): string | undefined {
    return this.getHeaderValue(headers["x-last-actions"]);
  }

  private extractActionElapsedMs(
    headers: Record<string, string | string[] | undefined>,
  ): number | undefined {
    const value = this.getHeaderValue(headers["x-action-elapsed-ms"]);
    if (!value) return undefined;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  }

}
