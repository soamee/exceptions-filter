import { Test } from "@nestjs/testing";
import { ClientErrorsController, CLIENT_ERRORS_API_KEY } from "../client-errors.controller";
import { ClientErrorsService, CLIENT_ERRORS_PERSISTENCE, CLIENT_ERRORS_ON_ERROR } from "../client-errors.service";

const mockStorage = {
  getSourceMap: jest.fn().mockResolvedValue(null),
  uploadSourceMap: jest.fn(),
  listVersions: jest.fn(),
};
const mockPersistence = {
  findDuplicate: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ id: "e1", exceptionMessage: "x", createdAt: new Date(), updatedAt: new Date() }),
};

describe("ClientErrorsController", () => {
  let controller: ClientErrorsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ClientErrorsController],
      providers: [
        ClientErrorsService,
        { provide: "SOURCE_MAP_STORAGE", useValue: mockStorage },
        { provide: CLIENT_ERRORS_PERSISTENCE, useValue: mockPersistence },
        { provide: CLIENT_ERRORS_ON_ERROR, useValue: undefined },
        { provide: CLIENT_ERRORS_API_KEY, useValue: "test-key" },
      ],
    }).compile();
    controller = module.get(ClientErrorsController);
  });

  it("should accept and persist a client error", async () => {
    const result = await controller.reportError({
      message: "Uncaught TypeError",
      platform: "web",
      appVersion: "1.0.0",
    } as any);
    expect(result.errorId).toBe("e1");
  });

  it("should reject sourcemap upload with wrong API key", async () => {
    await expect(
      controller.uploadSourceMap(
        { buffer: Buffer.from("{}"), originalname: "main.js.map" },
        "web", "1.0.0", "wrong-key",
      ),
    ).rejects.toThrow("Invalid API key");
  });

  it("should accept sourcemap upload with correct API key", async () => {
    const result = await controller.uploadSourceMap(
      { buffer: Buffer.from("{}"), originalname: "main.js.map" },
      "web", "1.0.0", "test-key",
    );
    expect(result.ok).toBe(true);
    expect(mockStorage.uploadSourceMap).toHaveBeenCalledWith("web", "1.0.0", "main.js", Buffer.from("{}"));
  });
});
