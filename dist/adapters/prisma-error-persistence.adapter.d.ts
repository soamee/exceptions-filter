import type { ErrorPersistenceAdapter } from "../interfaces/error-persistence.interface";
import type { CreateErrorData, DuplicateCheckCriteria, ErrorRecord } from "../interfaces/error-record.interface";
interface PrismaLikeClient {
    errorExceptionsMessage: {
        findFirst(args: {
            where: Record<string, unknown>;
        }): Promise<ErrorRecord | null>;
        create(args: {
            data: CreateErrorData;
        }): Promise<ErrorRecord>;
    };
}
export declare class PrismaErrorPersistenceAdapter implements ErrorPersistenceAdapter {
    private readonly db;
    constructor(db: PrismaLikeClient);
    findDuplicate(criteria: DuplicateCheckCriteria): Promise<ErrorRecord | null>;
    create(data: CreateErrorData): Promise<ErrorRecord>;
}
export {};
//# sourceMappingURL=prisma-error-persistence.adapter.d.ts.map