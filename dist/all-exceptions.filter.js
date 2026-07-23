"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const filter_config_interface_1 = require("./interfaces/filter-config.interface");
const sanitization_1 = require("./sanitization");
const sanitization_2 = require("./sanitization");
const skip_patterns_1 = require("./skip-patterns");
const detection_1 = require("./detection");
let ForbiddenError;
try {
    ForbiddenError = require("@casl/ability").ForbiddenError;
}
catch { }
let Sentry;
try {
    Sentry = require("@sentry/nestjs");
}
catch { }
let AllExceptionsFilter = class AllExceptionsFilter {
    config;
    logger;
    recentErrors = new Map();
    constructor(config) {
        this.config = config;
        if (config.logger) {
            this.logger = config.logger;
        }
        else {
            const nestLogger = new common_1.Logger("AllExceptionsFilter");
            this.logger = {
                error: (context, message) => nestLogger.error(message, context),
                warn: (context, message) => nestLogger.warn(message, context),
                info: (context, message) => nestLogger.log(message, context),
                debug: (context, message) => nestLogger.debug(message, context),
            };
        }
    }
    async catch(exception, host) {
        const ctx = host.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();
        const isHttpException = exception instanceof common_1.HttpException;
        const isForbiddenError = ForbiddenError && exception instanceof ForbiddenError;
        const status = isHttpException
            ? exception.getStatus()
            : isForbiddenError
                ? common_1.HttpStatus.FORBIDDEN
                : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = this.extractMessage(exception);
        // Allow projects to transform the message (e.g., enrich "File too large" with sizes)
        if (this.config.transformMessage) {
            message = this.config.transformMessage(message, exception, request);
        }
        const error = isHttpException
            ? exception.message
            : isForbiddenError
                ? exception.name
                : "Internal error occurred";
        // Sentry capture for unhandled 500s
        if (status === common_1.HttpStatus.INTERNAL_SERVER_ERROR &&
            !isHttpException &&
            this.config.enableSentry &&
            Sentry) {
            try {
                Sentry.captureException(exception);
            }
            catch {
                // ignore sentry errors
            }
        }
        // Check skipMethods → early return
        const skipMethods = this.config.skipMethods ?? ["HEAD", "MKCOL"];
        const method = request.method ?? "";
        if (skipMethods.includes(method)) {
            const clientMessage = this.getClientMessage(status, message, isHttpException);
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
        const clientMessage = this.getClientMessage(status, message, isHttpException);
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
        }
        else if (status >= 400) {
            this.logger.warn("AllExceptionsFilter", logMessage);
        }
        else {
            this.logger.info("AllExceptionsFilter", logMessage);
        }
        // Check skipPatterns → skip DB + notification if match
        const shouldSkip = (0, skip_patterns_1.shouldSkipException)(messageStr, this.config.extraSkipPatterns);
        let errorId;
        let persistedRecord = null;
        let isNewRecord = false;
        let isCrawler = false;
        if (!shouldSkip && this.config.persistence) {
            // Throttle: if throttled, skip DB persistence
            if (this.config.enableThrottling && isThrottled) {
                // Skip persistence for throttled errors
            }
            else {
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
            const crawlerInfo = (0, detection_1.detectCrawler)(request);
            isCrawler = crawlerInfo.isCrawler;
        }
        // onError callback — only for newly created records, not duplicates
        if (!shouldSkip &&
            isNewRecord &&
            persistedRecord &&
            this.config.onError &&
            !isCrawler &&
            !this.isFromExceptionController(request.url)) {
            try {
                await this.config.onError(persistedRecord);
            }
            catch (callbackError) {
                this.logger.error("AllExceptionsFilter", `onError callback failed: ${callbackError}`);
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
    extractMessage(exception) {
        if (exception instanceof common_1.HttpException) {
            const response = exception.getResponse();
            if (typeof response === "object" && response !== null) {
                const resp = response;
                if (Array.isArray(resp.message)) {
                    return resp.message;
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
    getClientMessage(status, message, isHttpException) {
        if (status === common_1.HttpStatus.INTERNAL_SERVER_ERROR &&
            !isHttpException &&
            this.config.hideInternalErrors !== false) {
            return "Internal server error";
        }
        return message;
    }
    getErrorResponse(params) {
        const { status, error, request, message, errorId } = params;
        const response = {
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
    extractFileName(exception) {
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
    async logErrorToDatabase(params) {
        const { exception, request, message } = params;
        const persistence = this.config.persistence;
        if (!persistence)
            return null;
        try {
            // Deduplication check (only when enableDeduplication is not explicitly false)
            if (this.config.enableDeduplication !== false) {
                const deduplicationWindowHours = this.config.deduplicationWindowHours ?? 24;
                const since = new Date();
                since.setHours(since.getHours() - deduplicationWindowHours);
                const existing = await persistence.findDuplicate({
                    exceptionMessage: message,
                    stackTrace: exception instanceof Error ? exception.stack : undefined,
                    requestMethod: request.method,
                    requestUrl: request.url,
                    requestBody: request.body
                        ? JSON.stringify((0, sanitization_2.sanitizeBody)(request.body, this.config.extraSensitiveFields))
                        : undefined,
                    since,
                });
                if (existing) {
                    return { record: existing, isNew: false };
                }
            }
            // Create new error record
            const sanitizedHeaders = (0, sanitization_1.sanitizeHeaders)(request.headers, this.config.extraSensitiveHeaders);
            const sanitizedBody = (0, sanitization_2.sanitizeBody)(request.body, this.config.extraSensitiveFields);
            const user = request.user;
            const file = this.extractFileName(exception);
            // Wire up request origin metadata when enabled
            let additionalMessages;
            if (this.config.enableRequestOriginMetadata !== false) {
                const originMetadata = (0, detection_1.extractRequestOrigin)(request);
                additionalMessages = JSON.stringify(originMetadata);
            }
            const created = await persistence.create({
                exceptionMessage: message,
                file,
                triggeredById: user?.id ?? user?.sub,
                stackTrace: exception instanceof Error ? exception.stack : undefined,
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
                clientVersion: this.getHeaderValue(request.headers["x-client-version"]),
                appModuleName: this.config.appName,
                correlationId: this.getHeaderValue(request.headers["x-correlation-id"] ??
                    request.headers["x-request-id"]),
                requestPath: request.url,
                requestContext: this.formatRequestContext(this.extractScreenContext(request.headers)),
                lastUserActions: this.extractLastActions(request.headers),
                actionElapsedMs: this.extractActionElapsedMs(request.headers),
            });
            return { record: created, isNew: true };
        }
        catch (dbError) {
            this.logger.error("AllExceptionsFilter", `Failed to persist error: ${dbError}`);
            return null;
        }
    }
    isThrottled(key, throttleMs) {
        const lastOccurrence = this.recentErrors.get(key);
        if (!lastOccurrence)
            return false;
        return Date.now() - lastOccurrence.getTime() < throttleMs;
    }
    cleanupRecentErrors() {
        const throttleMs = this.config.throttleMs ?? 1000;
        const now = Date.now();
        for (const [key, date] of this.recentErrors.entries()) {
            if (now - date.getTime() > throttleMs * 2) {
                this.recentErrors.delete(key);
            }
        }
    }
    isFromExceptionController(url) {
        const exceptionPaths = [
            "/error-exceptions-messages",
            "/exceptions",
            "/errors",
        ];
        return exceptionPaths.some((path) => url.startsWith(path));
    }
    getHeaderValue(header) {
        if (Array.isArray(header)) {
            return header[0] || undefined;
        }
        return header || undefined;
    }
    extractScreenContext(headers) {
        const screen = this.getHeaderValue(headers["x-screen-context"]);
        return screen;
    }
    formatRequestContext(context) {
        return context;
    }
    extractLastActions(headers) {
        return this.getHeaderValue(headers["x-last-actions"]);
    }
    extractActionElapsedMs(headers) {
        const value = this.getHeaderValue(headers["x-action-elapsed-ms"]);
        if (!value)
            return undefined;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? undefined : parsed;
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)(),
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(filter_config_interface_1.EXCEPTIONS_FILTER_CONFIG)),
    __metadata("design:paramtypes", [Object])
], AllExceptionsFilter);
