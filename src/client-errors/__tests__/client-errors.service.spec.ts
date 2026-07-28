import { ClientErrorsService } from "../client-errors.service";
import type { SourceMapStorage } from "../source-map-storage.interface";
import type { ErrorPersistenceAdapter } from "../../interfaces/error-persistence.interface";

const mockStorage: SourceMapStorage = {
  getSourceMap: jest.fn().mockResolvedValue(null),
  uploadSourceMap: jest.fn(),
  listVersions: jest.fn(),
};

const mockRecord = {
  id: "err-1",
  exceptionMessage: "Test error",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPersistence: ErrorPersistenceAdapter = {
  findDuplicate: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue(mockRecord),
};

describe("ClientErrorsService", () => {
  let service: ClientErrorsService;
  const onError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClientErrorsService(mockStorage, mockPersistence, onError);
  });

  it("should persist a new client error and return errorId", async () => {
    const result = await service.handleClientError({
      message: "Test error",
      platform: "web",
      appVersion: "1.0.0",
      stack: "Error: Test\n    at main.js:1:1",
    });
    expect(result.errorId).toBe("err-1");
    expect(mockPersistence.create).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(mockRecord);
  });

  it("should skip duplicate errors and return existing id", async () => {
    (mockPersistence.findDuplicate as jest.Mock).mockResolvedValueOnce(mockRecord);
    const result = await service.handleClientError({
      message: "Test error",
      platform: "web",
      appVersion: "1.0.0",
    });
    expect(result.errorId).toBe("err-1");
    expect(mockPersistence.create).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
