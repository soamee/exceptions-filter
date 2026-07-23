"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaErrorPersistenceAdapter = void 0;
class PrismaErrorPersistenceAdapter {
    db;
    constructor(db) {
        this.db = db;
    }
    async findDuplicate(criteria) {
        const where = {
            exceptionMessage: criteria.exceptionMessage,
            createdAt: { gte: criteria.since },
        };
        if (criteria.stackTrace !== undefined)
            where.stackTrace = criteria.stackTrace;
        if (criteria.requestMethod !== undefined)
            where.requestMethod = criteria.requestMethod;
        if (criteria.requestUrl !== undefined)
            where.requestUrl = criteria.requestUrl;
        if (criteria.requestBody !== undefined)
            where.requestBody = criteria.requestBody;
        return this.db.errorExceptionsMessage.findFirst({ where });
    }
    async create(data) {
        return this.db.errorExceptionsMessage.create({ data });
    }
}
exports.PrismaErrorPersistenceAdapter = PrismaErrorPersistenceAdapter;
