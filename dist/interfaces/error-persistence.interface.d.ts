import { CreateErrorData, DuplicateCheckCriteria, ErrorRecord } from "./error-record.interface";
export interface ErrorPersistenceAdapter {
    findDuplicate(criteria: DuplicateCheckCriteria): Promise<ErrorRecord | null>;
    create(data: CreateErrorData): Promise<ErrorRecord>;
}
//# sourceMappingURL=error-persistence.interface.d.ts.map