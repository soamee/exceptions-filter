import { PrismaErrorPersistenceAdapter } from "../../src/adapters";
import type { CreateErrorData, DuplicateCheckCriteria } from "../../src/interfaces";

function createMockDb() {
  return {
    errorExceptionsMessage: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
}

describe("PrismaErrorPersistenceAdapter", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let adapter: PrismaErrorPersistenceAdapter;

  beforeEach(() => {
    mockDb = createMockDb();
    adapter = new PrismaErrorPersistenceAdapter(mockDb);
  });

  describe("findDuplicate", () => {
    it("should call findFirst with correct criteria", async () => {
      const since = new Date("2026-07-22T00:00:00Z");
      const criteria: DuplicateCheckCriteria = {
        exceptionMessage: "Test error",
        stackTrace: "at test.ts:1",
        requestMethod: "GET",
        requestUrl: "/test",
        requestBody: "{}",
        since,
      };

      mockDb.errorExceptionsMessage.findFirst.mockResolvedValue(null);

      await adapter.findDuplicate(criteria);

      expect(mockDb.errorExceptionsMessage.findFirst).toHaveBeenCalledWith({
        where: {
          exceptionMessage: "Test error",
          stackTrace: "at test.ts:1",
          requestMethod: "GET",
          requestUrl: "/test",
          requestBody: "{}",
          createdAt: { gte: since },
        },
      });
    });

    it("should return null when no duplicate found", async () => {
      mockDb.errorExceptionsMessage.findFirst.mockResolvedValue(null);
      const result = await adapter.findDuplicate({
        exceptionMessage: "Test",
        since: new Date(),
      });
      expect(result).toBeNull();
    });

    it("should return record when duplicate found", async () => {
      const existing = { id: "uuid-1", exceptionMessage: "Test", createdAt: new Date(), updatedAt: new Date() };
      mockDb.errorExceptionsMessage.findFirst.mockResolvedValue(existing);
      const result = await adapter.findDuplicate({
        exceptionMessage: "Test",
        since: new Date(),
      });
      expect(result).toEqual(existing);
    });
  });

  describe("create", () => {
    it("should call create with data", async () => {
      const data: CreateErrorData = {
        exceptionMessage: "Test error",
        requestMethod: "POST",
        requestUrl: "/api/test",
      };
      const created = { id: "uuid-2", ...data, createdAt: new Date(), updatedAt: new Date() };
      mockDb.errorExceptionsMessage.create.mockResolvedValue(created);

      const result = await adapter.create(data);

      expect(mockDb.errorExceptionsMessage.create).toHaveBeenCalledWith({ data });
      expect(result.id).toBe("uuid-2");
    });
  });
});
