import { Injectable, Inject } from "@nestjs/common";
import type { ErrorPersistenceAdapter } from "../interfaces/error-persistence.interface";
import type { ErrorRecord } from "../interfaces/error-record.interface";
import type { SourceMapStorage } from "./source-map-storage.interface";
import { SourceMapResolver } from "./source-map-resolver";
import type { ClientErrorDto } from "./client-error.dto";

export const CLIENT_ERRORS_PERSISTENCE = Symbol("CLIENT_ERRORS_PERSISTENCE");
export const CLIENT_ERRORS_ON_ERROR = Symbol("CLIENT_ERRORS_ON_ERROR");

@Injectable()
export class ClientErrorsService {
  private readonly resolver: SourceMapResolver;

  constructor(
    @Inject("SOURCE_MAP_STORAGE") private readonly storage: SourceMapStorage,
    @Inject(CLIENT_ERRORS_PERSISTENCE) private readonly persistence: ErrorPersistenceAdapter,
    @Inject(CLIENT_ERRORS_ON_ERROR) private readonly onError?: (error: ErrorRecord) => Promise<void>,
  ) {
    this.resolver = new SourceMapResolver(storage);
  }

  async handleClientError(
    dto: ClientErrorDto,
  ): Promise<{ errorId?: string }> {
    const since = new Date();
    since.setHours(since.getHours() - 24);

    const existing = await this.persistence.findDuplicate({
      exceptionMessage: dto.message,
      stackTrace: dto.stack,
      requestMethod: "CLIENT_ERROR",
      since,
    });

    if (existing) {
      return { errorId: existing.id };
    }

    let resolvedStack = dto.stack;
    if (dto.stack) {
      try {
        resolvedStack = await this.resolver.resolveStack(
          dto.stack,
          dto.platform,
          dto.appVersion,
        );
      } catch {
        // Use raw stack if resolution fails
      }
    }

    const record = await this.persistence.create({
      exceptionMessage: dto.message,
      stackTrace: resolvedStack,
      requestMethod: "CLIENT_ERROR",
      appModuleName: dto.platform,
      clientVersion: dto.appVersion,
      requestContext: dto.screen,
      lastUserActions: dto.lastActions?.join(" → "),
      userAgent: dto.userAgent,
      triggeredById: dto.userId,
      additionalMessages: dto.metadata
        ? JSON.stringify(dto.metadata)
        : undefined,
    });

    if (this.onError) {
      try {
        await this.onError(record);
      } catch {
        // Don't fail the request if callback errors
      }
    }

    return { errorId: record.id };
  }
}
