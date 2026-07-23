import type { ErrorPersistenceAdapter } from "../interfaces/error-persistence.interface";
import type {
  CreateErrorData,
  DuplicateCheckCriteria,
  ErrorRecord,
} from "../interfaces/error-record.interface";

interface PrismaLikeClient {
  errorExceptionsMessage: {
    findFirst(args: { where: Record<string, unknown> }): Promise<ErrorRecord | null>;
    create(args: { data: CreateErrorData }): Promise<ErrorRecord>;
  };
}

export class PrismaErrorPersistenceAdapter implements ErrorPersistenceAdapter {
  constructor(private readonly db: PrismaLikeClient) {}

  async findDuplicate(
    criteria: DuplicateCheckCriteria,
  ): Promise<ErrorRecord | null> {
    const where: Record<string, unknown> = {
      exceptionMessage: criteria.exceptionMessage,
      createdAt: { gte: criteria.since },
    };

    if (criteria.stackTrace !== undefined) where.stackTrace = criteria.stackTrace;
    if (criteria.requestMethod !== undefined) where.requestMethod = criteria.requestMethod;
    if (criteria.requestUrl !== undefined) where.requestUrl = criteria.requestUrl;
    if (criteria.requestBody !== undefined) where.requestBody = criteria.requestBody;

    return this.db.errorExceptionsMessage.findFirst({ where });
  }

  async create(data: CreateErrorData): Promise<ErrorRecord> {
    return this.db.errorExceptionsMessage.create({ data });
  }
}
