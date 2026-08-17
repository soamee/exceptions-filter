// src/__tests__/client-errors-integration.spec.ts
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ClientErrorsModule } from "../client-errors";
import { LocalSourceMapStorage } from "../client-errors/adapters";
import type { ErrorPersistenceAdapter } from "../interfaces/error-persistence.interface";

describe("Client Errors Integration", () => {
  let app: INestApplication;
  let tmpDir: string;
  const createdRecords: any[] = [];

  const mockPersistence: ErrorPersistenceAdapter = {
    findDuplicate: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async (data) => {
      const record = { id: `err-${createdRecords.length}`, ...data, createdAt: new Date(), updatedAt: new Date() };
      createdRecords.push(record);
      return record;
    }),
  };

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-maps-"));

    const moduleRef = await Test.createTestingModule({
      imports: [
        ClientErrorsModule.register({
          sourceMapStorage: new LocalSourceMapStorage({ basePath: tmpDir }),
          persistence: mockPersistence,
          apiKey: "test-key-123",
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("POST /client-errors should persist error and return errorId", async () => {
    const res = await request(app.getHttpServer())
      .post("/client-errors")
      .send({
        message: "TypeError: Cannot read property 'x' of undefined",
        stack: "TypeError: ...\n    at main.js:1:100",
        platform: "web",
        appVersion: "1.0.0",
        screen: "/dashboard",
      })
      .expect(201);

    expect(res.body.errorId).toBeDefined();
    expect(mockPersistence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        exceptionMessage: "TypeError: Cannot read property 'x' of undefined",
        appModuleName: "web",
        clientVersion: "1.0.0",
        requestContext: "/dashboard",
        requestMethod: "CLIENT_ERROR",
      }),
    );
  });

  it("POST /client-errors should reject invalid payload", async () => {
    await request(app.getHttpServer())
      .post("/client-errors")
      .send({ platform: "invalid" })
      .expect(400);
  });

  it("POST /client-errors/sourcemaps should reject without API key", async () => {
    await request(app.getHttpServer())
      .post("/client-errors/sourcemaps")
      .attach("file", Buffer.from("{}"), "main.js.map")
      .field("platform", "web")
      .field("version", "1.0.0")
      .expect(401);
  });

  it("POST /client-errors/sourcemaps should accept with correct API key", async () => {
    await request(app.getHttpServer())
      .post("/client-errors/sourcemaps")
      .set("x-sourcemap-api-key", "test-key-123")
      .attach("file", Buffer.from('{"version":3}'), "main.js.map")
      .field("platform", "web")
      .field("version", "1.0.0")
      .expect(201);

    // Verify the file was stored
    const stored = fs.readFileSync(
      path.join(tmpDir, "web", "1.0.0", "main.js.map"),
      "utf-8",
    );
    expect(stored).toBe('{"version":3}');
  });
});
