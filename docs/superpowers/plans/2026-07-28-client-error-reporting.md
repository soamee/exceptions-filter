# Client Error Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side error capture (web + React Native) with server-side source map resolution to `@soamee/exceptions-filter`.

**Architecture:** Extend the existing monopaquete with three new subsystems: (1) a NestJS backend module that receives client errors, resolves minified stacks via uploaded source maps, and persists them through the existing `ErrorPersistenceAdapter`; (2) a zero-dependency client SDK for web and React Native; (3) a CLI tool for uploading source maps during CI/CD.

**Tech Stack:** TypeScript, NestJS 9+, `source-map` (Mozilla), `@aws-sdk/client-s3` (optional peer dep), native `fetch`/`sendBeacon`.

## Global Constraints

- Package: `@soamee/exceptions-filter`, extend existing — no new repos
- TypeScript strict mode, `target: ES2022`, `module: commonjs`
- NestJS peer dep: `>=9.0.0`
- Client SDK: zero external dependencies
- Existing interfaces (`ErrorPersistenceAdapter`, `CreateErrorData`, `ErrorRecord`) must not be modified, only consumed
- Tests: Jest (already configured)
- `rootDir` is `./src` — CLI lives at `src/cli/`, not top-level `cli/`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/client-errors/source-map-storage.interface.ts` | `SourceMapStorage` interface |
| Create | `src/client-errors/adapters/local-source-map-storage.ts` | Filesystem storage adapter |
| Create | `src/client-errors/adapters/s3-source-map-storage.ts` | S3 storage adapter |
| Create | `src/client-errors/adapters/index.ts` | Re-exports |
| Create | `src/client-errors/source-map-resolver.ts` | Parse stack frames, resolve via `.map` files |
| Create | `src/client-errors/client-error.dto.ts` | `ClientErrorDto` validation class |
| Create | `src/client-errors/client-errors.service.ts` | Dedup + resolve + persist |
| Create | `src/client-errors/client-errors.controller.ts` | HTTP endpoints |
| Create | `src/client-errors/client-errors.module.ts` | NestJS dynamic module |
| Create | `src/client-errors/index.ts` | Re-exports |
| Create | `src/client-sdk/reporter.ts` | Core reporter: queue, dedup, batch send |
| Create | `src/client-sdk/web.ts` | Web error hooks |
| Create | `src/client-sdk/react.ts` | ErrorBoundary + hook |
| Create | `src/client-sdk/react-native.ts` | RN error hooks |
| Create | `src/client-sdk/index.ts` | Re-exports |
| Create | `src/cli/upload-sourcemaps.ts` | CLI entry point |
| Modify | `src/index.ts` | Add exports for `ClientErrorsModule`, storage adapters |
| Modify | `package.json` | Add `exports`, `bin`, new deps, peer deps |
| Modify | `tsconfig.build.json` | No change needed (already includes `src/**/*`) |

---

### Task 1: Source Map Storage Interface + Local Adapter

**Files:**
- Create: `src/client-errors/source-map-storage.interface.ts`
- Create: `src/client-errors/adapters/local-source-map-storage.ts`
- Create: `src/client-errors/adapters/index.ts`
- Test: `src/client-errors/adapters/__tests__/local-source-map-storage.spec.ts`

**Interfaces:**
- Consumes: nothing (foundational)
- Produces: `SourceMapStorage` interface with `getSourceMap(platform: string, version: string, filename: string): Promise<string | null>`, `uploadSourceMap(platform: string, version: string, filename: string, content: Buffer): Promise<void>`, `listVersions(platform: string): Promise<string[]>`. `LocalSourceMapStorage` class implementing it with constructor `({ basePath: string })`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/client-errors/adapters/__tests__/local-source-map-storage.spec.ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { LocalSourceMapStorage } from "../local-source-map-storage";

describe("LocalSourceMapStorage", () => {
  let storage: LocalSourceMapStorage;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sourcemaps-"));
    storage = new LocalSourceMapStorage({ basePath: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return null when source map does not exist", async () => {
    const result = await storage.getSourceMap("web", "1.0.0", "main.js");
    expect(result).toBeNull();
  });

  it("should upload and retrieve a source map", async () => {
    const content = Buffer.from('{"version":3,"sources":["main.ts"]}');
    await storage.uploadSourceMap("web", "1.0.0", "main.js", content);
    const result = await storage.getSourceMap("web", "1.0.0", "main.js");
    expect(result).toBe('{"version":3,"sources":["main.ts"]}');
  });

  it("should list versions for a platform", async () => {
    await storage.uploadSourceMap("web", "1.0.0", "a.js", Buffer.from("{}"));
    await storage.uploadSourceMap("web", "2.0.0", "b.js", Buffer.from("{}"));
    await storage.uploadSourceMap("ios", "3.0.0", "c.js", Buffer.from("{}"));
    const versions = await storage.listVersions("web");
    expect(versions.sort()).toEqual(["1.0.0", "2.0.0"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/client-errors/adapters/__tests__/local-source-map-storage.spec.ts --no-coverage`
Expected: FAIL — modules not found

- [ ] **Step 3: Create the interface**

```typescript
// src/client-errors/source-map-storage.interface.ts
export const SOURCE_MAP_STORAGE = Symbol("SOURCE_MAP_STORAGE");

export interface SourceMapStorage {
  getSourceMap(
    platform: string,
    version: string,
    filename: string,
  ): Promise<string | null>;

  uploadSourceMap(
    platform: string,
    version: string,
    filename: string,
    content: Buffer,
  ): Promise<void>;

  listVersions(platform: string): Promise<string[]>;
}
```

- [ ] **Step 4: Implement LocalSourceMapStorage**

```typescript
// src/client-errors/adapters/local-source-map-storage.ts
import * as fs from "fs";
import * as path from "path";
import type { SourceMapStorage } from "../source-map-storage.interface";

export class LocalSourceMapStorage implements SourceMapStorage {
  constructor(private readonly config: { basePath: string }) {}

  async getSourceMap(
    platform: string,
    version: string,
    filename: string,
  ): Promise<string | null> {
    const filePath = this.buildPath(platform, version, `${filename}.map`);
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  async uploadSourceMap(
    platform: string,
    version: string,
    filename: string,
    content: Buffer,
  ): Promise<void> {
    const filePath = this.buildPath(platform, version, `${filename}.map`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  async listVersions(platform: string): Promise<string[]> {
    const platformDir = path.join(this.config.basePath, platform);
    try {
      return fs.readdirSync(platformDir).filter((entry) => {
        return fs.statSync(path.join(platformDir, entry)).isDirectory();
      });
    } catch {
      return [];
    }
  }

  private buildPath(platform: string, version: string, file: string): string {
    return path.join(this.config.basePath, platform, version, file);
  }
}
```

- [ ] **Step 5: Create adapters index**

```typescript
// src/client-errors/adapters/index.ts
export { LocalSourceMapStorage } from "./local-source-map-storage";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/client-errors/adapters/__tests__/local-source-map-storage.spec.ts --no-coverage`
Expected: PASS — 3 tests

- [ ] **Step 7: Commit**

```bash
git add src/client-errors/
git commit -m "feat(client-errors): add SourceMapStorage interface and local adapter"
```

---

### Task 2: S3 Source Map Storage Adapter

**Files:**
- Create: `src/client-errors/adapters/s3-source-map-storage.ts`
- Modify: `src/client-errors/adapters/index.ts`
- Test: `src/client-errors/adapters/__tests__/s3-source-map-storage.spec.ts`

**Interfaces:**
- Consumes: `SourceMapStorage` from Task 1
- Produces: `S3SourceMapStorage` class with constructor `({ bucket: string, region: string, prefix?: string })`

- [ ] **Step 1: Write the failing test (mocked S3)**

```typescript
// src/client-errors/adapters/__tests__/s3-source-map-storage.spec.ts
import { S3SourceMapStorage } from "../s3-source-map-storage";

const mockSend = jest.fn();
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  GetObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: "GetObject" })),
  PutObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: "PutObject" })),
  ListObjectsV2Command: jest.fn().mockImplementation((params) => ({ ...params, _type: "ListObjects" })),
}));

describe("S3SourceMapStorage", () => {
  let storage: S3SourceMapStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new S3SourceMapStorage({ bucket: "test-bucket", region: "eu-west-1" });
  });

  it("should return null when S3 object does not exist", async () => {
    mockSend.mockRejectedValueOnce({ name: "NoSuchKey" });
    const result = await storage.getSourceMap("web", "1.0.0", "main.js");
    expect(result).toBeNull();
  });

  it("should return source map content from S3", async () => {
    const body = { transformToString: jest.fn().mockResolvedValue('{"version":3}') };
    mockSend.mockResolvedValueOnce({ Body: body });
    const result = await storage.getSourceMap("web", "1.0.0", "main.js");
    expect(result).toBe('{"version":3}');
  });

  it("should upload source map to S3", async () => {
    mockSend.mockResolvedValueOnce({});
    await storage.uploadSourceMap("web", "1.0.0", "main.js", Buffer.from("content"));
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should list versions from S3 common prefixes", async () => {
    mockSend.mockResolvedValueOnce({
      CommonPrefixes: [{ Prefix: "web/1.0.0/" }, { Prefix: "web/2.0.0/" }],
    });
    const versions = await storage.listVersions("web");
    expect(versions).toEqual(["1.0.0", "2.0.0"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/client-errors/adapters/__tests__/s3-source-map-storage.spec.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement S3SourceMapStorage**

```typescript
// src/client-errors/adapters/s3-source-map-storage.ts
import type { SourceMapStorage } from "../source-map-storage.interface";

interface S3StorageConfig {
  bucket: string;
  region: string;
  prefix?: string;
}

export class S3SourceMapStorage implements SourceMapStorage {
  private readonly client: any;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(config: S3StorageConfig) {
    const { S3Client } = require("@aws-sdk/client-s3");
    this.client = new S3Client({ region: config.region });
    this.bucket = config.bucket;
    this.prefix = config.prefix ?? "";
  }

  async getSourceMap(
    platform: string,
    version: string,
    filename: string,
  ): Promise<string | null> {
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    const key = this.buildKey(platform, version, `${filename}.map`);
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return response.Body.transformToString("utf-8");
    } catch {
      return null;
    }
  }

  async uploadSourceMap(
    platform: string,
    version: string,
    filename: string,
    content: Buffer,
  ): Promise<void> {
    const { PutObjectCommand } = require("@aws-sdk/client-s3");
    const key = this.buildKey(platform, version, `${filename}.map`);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: "application/json",
      }),
    );
  }

  async listVersions(platform: string): Promise<string[]> {
    const { ListObjectsV2Command } = require("@aws-sdk/client-s3");
    const prefix = this.prefix
      ? `${this.prefix}/${platform}/`
      : `${platform}/`;
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        Delimiter: "/",
      }),
    );
    return (response.CommonPrefixes ?? [])
      .map((cp: { Prefix?: string }) => cp.Prefix?.replace(prefix, "").replace("/", ""))
      .filter(Boolean);
  }

  private buildKey(platform: string, version: string, file: string): string {
    const parts = [platform, version, file];
    if (this.prefix) parts.unshift(this.prefix);
    return parts.join("/");
  }
}
```

- [ ] **Step 4: Update adapters index**

```typescript
// src/client-errors/adapters/index.ts
export { LocalSourceMapStorage } from "./local-source-map-storage";
export { S3SourceMapStorage } from "./s3-source-map-storage";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/client-errors/adapters/__tests__/s3-source-map-storage.spec.ts --no-coverage`
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/client-errors/adapters/
git commit -m "feat(client-errors): add S3 source map storage adapter"
```

---

### Task 3: Source Map Resolver

**Files:**
- Create: `src/client-errors/source-map-resolver.ts`
- Test: `src/client-errors/__tests__/source-map-resolver.spec.ts`

**Interfaces:**
- Consumes: `SourceMapStorage` from Task 1
- Produces: `SourceMapResolver` class with method `resolveStack(rawStack: string, platform: string, version: string): Promise<string>`

- [ ] **Step 1: Add `source-map` dependency**

Run: `npm install source-map@^0.7.4`

- [ ] **Step 2: Write the failing test**

```typescript
// src/client-errors/__tests__/source-map-resolver.spec.ts
import { SourceMapResolver } from "../source-map-resolver";
import type { SourceMapStorage } from "../source-map-storage.interface";

// Minimal valid source map: maps line 1, col 0 of "out.js" to line 5, col 4 of "src/app.ts"
const VALID_SOURCE_MAP = JSON.stringify({
  version: 3,
  sources: ["src/app.ts"],
  names: [],
  mappings: "IAIA",
  sourcesContent: ['    throw new Error("test")'],
});

function createMockStorage(maps: Record<string, string>): SourceMapStorage {
  return {
    getSourceMap: jest.fn(async (_p, _v, filename) => maps[filename] ?? null),
    uploadSourceMap: jest.fn(),
    listVersions: jest.fn(),
  };
}

describe("SourceMapResolver", () => {
  it("should return raw stack when no source maps exist", async () => {
    const storage = createMockStorage({});
    const resolver = new SourceMapResolver(storage);
    const raw = "Error: boom\n    at Object.<anonymous> (out.js:1:1)";
    const result = await resolver.resolveStack(raw, "web", "1.0.0");
    expect(result).toBe(raw);
  });

  it("should resolve stack frames using source map", async () => {
    const storage = createMockStorage({ "out.js": VALID_SOURCE_MAP });
    const resolver = new SourceMapResolver(storage);
    const raw = "Error: boom\n    at Object.<anonymous> (out.js:1:1)";
    const result = await resolver.resolveStack(raw, "web", "1.0.0");
    expect(result).toContain("src/app.ts");
  });

  it("should handle unparseable stack gracefully", async () => {
    const storage = createMockStorage({});
    const resolver = new SourceMapResolver(storage);
    const result = await resolver.resolveStack("not a stack trace", "web", "1.0.0");
    expect(result).toBe("not a stack trace");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/client-errors/__tests__/source-map-resolver.spec.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 4: Implement SourceMapResolver**

```typescript
// src/client-errors/source-map-resolver.ts
import type { SourceMapStorage } from "./source-map-storage.interface";

interface StackFrame {
  raw: string;
  filename?: string;
  line?: number;
  column?: number;
}

export class SourceMapResolver {
  private readonly cache = new Map<string, any>();
  private static readonly MAX_CACHE = 50;

  constructor(private readonly storage: SourceMapStorage) {}

  async resolveStack(
    rawStack: string,
    platform: string,
    version: string,
  ): Promise<string> {
    const lines = rawStack.split("\n");
    const resolvedLines: string[] = [];

    for (const line of lines) {
      const frame = this.parseFrame(line);
      if (!frame.filename || frame.line === undefined) {
        resolvedLines.push(line);
        continue;
      }

      try {
        const consumer = await this.getConsumer(platform, version, frame.filename);
        if (!consumer) {
          resolvedLines.push(line);
          continue;
        }

        const pos = consumer.originalPositionFor({
          line: frame.line,
          column: frame.column ?? 0,
        });

        if (pos.source) {
          resolvedLines.push(
            `    at ${pos.name ?? "<anonymous>"} (${pos.source}:${pos.line}:${pos.column ?? 0})`,
          );
        } else {
          resolvedLines.push(line);
        }
      } catch {
        resolvedLines.push(line);
      }
    }

    return resolvedLines.join("\n");
  }

  private parseFrame(line: string): StackFrame {
    // Match patterns like "at Foo (file.js:10:20)" or "at file.js:10:20"
    const match = line.match(
      /at\s+(?:.*?\s+)?\(?([^:()]+):(\d+):(\d+)\)?/,
    );
    if (!match) return { raw: line };
    return {
      raw: line,
      filename: match[1].trim(),
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    };
  }

  private async getConsumer(
    platform: string,
    version: string,
    filename: string,
  ): Promise<any | null> {
    const cacheKey = `${platform}/${version}/${filename}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const mapContent = await this.storage.getSourceMap(platform, version, filename);
    if (!mapContent) return null;

    const { SourceMapConsumer } = await import("source-map");
    const consumer = await new SourceMapConsumer(JSON.parse(mapContent));

    if (this.cache.size >= SourceMapResolver.MAX_CACHE) {
      const firstKey = this.cache.keys().next().value;
      const old = this.cache.get(firstKey);
      if (old?.destroy) old.destroy();
      this.cache.delete(firstKey);
    }

    this.cache.set(cacheKey, consumer);
    return consumer;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/client-errors/__tests__/source-map-resolver.spec.ts --no-coverage`
Expected: PASS — 3 tests

- [ ] **Step 6: Commit**

```bash
git add src/client-errors/source-map-resolver.ts src/client-errors/__tests__/
git commit -m "feat(client-errors): add source map resolver with LRU cache"
```

---

### Task 4: Client Errors DTO, Service, Controller, and Module

**Files:**
- Create: `src/client-errors/client-error.dto.ts`
- Create: `src/client-errors/client-errors.service.ts`
- Create: `src/client-errors/client-errors.controller.ts`
- Create: `src/client-errors/client-errors.module.ts`
- Create: `src/client-errors/index.ts`
- Modify: `src/index.ts`
- Test: `src/client-errors/__tests__/client-errors.service.spec.ts`
- Test: `src/client-errors/__tests__/client-errors.controller.spec.ts`

**Interfaces:**
- Consumes: `SourceMapResolver` (Task 3), `SourceMapStorage` (Task 1), `ErrorPersistenceAdapter` + `CreateErrorData` + `ErrorRecord` (existing)
- Produces: `ClientErrorsModule.register(config)` static method, `ClientErrorsController` with `POST /client-errors` and `POST /client-errors/sourcemaps`, `ClientErrorsService` with `handleClientError(dto: ClientErrorDto): Promise<{ errorId?: string }>`

- [ ] **Step 1: Create the DTO**

```typescript
// src/client-errors/client-error.dto.ts
import { IsString, IsOptional, IsIn, IsArray, MaxLength } from "class-validator";

export class ClientErrorDto {
  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  stack?: string;

  @IsIn(["web", "ios", "android"])
  platform!: "web" | "ios" | "android";

  @IsString()
  @MaxLength(100)
  appVersion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  screen?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lastActions?: string[];

  @IsOptional()
  metadata?: Record<string, unknown>;
}
```

- [ ] **Step 2: Write the service test**

```typescript
// src/client-errors/__tests__/client-errors.service.spec.ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/client-errors/__tests__/client-errors.service.spec.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 4: Implement the service**

```typescript
// src/client-errors/client-errors.service.ts
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
```

- [ ] **Step 5: Run service test to verify it passes**

Run: `npx jest src/client-errors/__tests__/client-errors.service.spec.ts --no-coverage`
Expected: PASS — 2 tests

- [ ] **Step 6: Implement the controller**

```typescript
// src/client-errors/client-errors.controller.ts
import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ClientErrorDto } from "./client-error.dto";
import { ClientErrorsService } from "./client-errors.service";
import type { SourceMapStorage } from "./source-map-storage.interface";

export const CLIENT_ERRORS_API_KEY = Symbol("CLIENT_ERRORS_API_KEY");

@Controller("client-errors")
export class ClientErrorsController {
  constructor(
    private readonly service: ClientErrorsService,
    @Inject("SOURCE_MAP_STORAGE") private readonly storage: SourceMapStorage,
    @Inject(CLIENT_ERRORS_API_KEY) private readonly apiKey: string,
  ) {}

  @Post()
  @HttpCode(201)
  async reportError(
    @Body() dto: ClientErrorDto,
  ): Promise<{ errorId?: string }> {
    return this.service.handleClientError(dto);
  }

  @Post("sourcemaps")
  @HttpCode(201)
  @UseInterceptors(FileInterceptor("file"))
  async uploadSourceMap(
    @UploadedFile() file: { buffer: Buffer; originalname: string },
    @Body("platform") platform: string,
    @Body("version") version: string,
    @Headers("x-sourcemap-api-key") providedKey: string,
  ): Promise<{ ok: boolean }> {
    if (providedKey !== this.apiKey) {
      throw new UnauthorizedException("Invalid API key");
    }
    const filename = file.originalname.replace(/\.map$/, "");
    await this.storage.uploadSourceMap(platform, version, filename, file.buffer);
    return { ok: true };
  }
}
```

- [ ] **Step 7: Implement the module**

```typescript
// src/client-errors/client-errors.module.ts
import { DynamicModule, Module } from "@nestjs/common";
import type { ErrorPersistenceAdapter } from "../interfaces/error-persistence.interface";
import type { ErrorRecord } from "../interfaces/error-record.interface";
import type { SourceMapStorage } from "./source-map-storage.interface";
import { ClientErrorsController } from "./client-errors.controller";
import {
  ClientErrorsService,
  CLIENT_ERRORS_PERSISTENCE,
  CLIENT_ERRORS_ON_ERROR,
} from "./client-errors.service";
import { CLIENT_ERRORS_API_KEY } from "./client-errors.controller";

export interface ClientErrorsModuleConfig {
  sourceMapStorage: SourceMapStorage;
  persistence: ErrorPersistenceAdapter;
  onError?: (error: ErrorRecord) => Promise<void>;
  apiKey: string;
}

@Module({})
export class ClientErrorsModule {
  static register(config: ClientErrorsModuleConfig): DynamicModule {
    return {
      module: ClientErrorsModule,
      controllers: [ClientErrorsController],
      providers: [
        { provide: "SOURCE_MAP_STORAGE", useValue: config.sourceMapStorage },
        { provide: CLIENT_ERRORS_PERSISTENCE, useValue: config.persistence },
        { provide: CLIENT_ERRORS_ON_ERROR, useValue: config.onError },
        { provide: CLIENT_ERRORS_API_KEY, useValue: config.apiKey },
        ClientErrorsService,
      ],
    };
  }
}
```

- [ ] **Step 8: Create client-errors index and update main index**

```typescript
// src/client-errors/index.ts
export { ClientErrorsModule } from "./client-errors.module";
export type { ClientErrorsModuleConfig } from "./client-errors.module";
export { ClientErrorsController } from "./client-errors.controller";
export { ClientErrorsService } from "./client-errors.service";
export { SourceMapResolver } from "./source-map-resolver";
export type { SourceMapStorage } from "./source-map-storage.interface";
export { SOURCE_MAP_STORAGE } from "./source-map-storage.interface";
export { LocalSourceMapStorage } from "./adapters";
export { S3SourceMapStorage } from "./adapters";
```

Add to `src/index.ts`:
```typescript
// Append after existing exports:
export {
  ClientErrorsModule,
  SourceMapResolver,
  LocalSourceMapStorage,
  S3SourceMapStorage,
} from "./client-errors";
export type { ClientErrorsModuleConfig, SourceMapStorage } from "./client-errors";
```

- [ ] **Step 9: Write controller integration test**

```typescript
// src/client-errors/__tests__/client-errors.controller.spec.ts
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
```

- [ ] **Step 10: Run all client-errors tests**

Run: `npx jest src/client-errors/ --no-coverage`
Expected: PASS — all tests

- [ ] **Step 11: Commit**

```bash
git add src/client-errors/ src/index.ts
git commit -m "feat(client-errors): add DTO, service, controller, and NestJS module"
```

---

### Task 5: Client SDK — Core Reporter, Web, React, and React Native

**Files:**
- Create: `src/client-sdk/reporter.ts`
- Create: `src/client-sdk/web.ts`
- Create: `src/client-sdk/react.ts`
- Create: `src/client-sdk/react-native.ts`
- Create: `src/client-sdk/index.ts`
- Test: `src/client-sdk/__tests__/reporter.spec.ts`

**Interfaces:**
- Consumes: `ClientErrorPayload` contract (defined inline — same shape as `ClientErrorDto`)
- Produces: `initErrorReporter(config)`, `reportError(error, context?)`, `setCurrentScreen(name)`, `SoameeErrorBoundary` (React component), `useErrorReporter()` (React hook)

- [ ] **Step 1: Write the reporter test**

```typescript
// src/client-sdk/__tests__/reporter.spec.ts
import { ErrorReporter } from "../reporter";

// Mock fetch globally
const mockFetch = jest.fn().mockResolvedValue({ ok: true });
(globalThis as any).fetch = mockFetch;

describe("ErrorReporter", () => {
  let reporter: ErrorReporter;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    reporter = new ErrorReporter({
      apiUrl: "https://api.test.com",
      appVersion: "1.0.0",
      platform: "web",
    });
  });

  afterEach(() => {
    reporter.destroy();
    jest.useRealTimers();
  });

  it("should queue an error and flush after interval", () => {
    reporter.report({ message: "test error", stack: "Error: test" });
    expect(mockFetch).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message).toBe("test error");
    expect(body.appVersion).toBe("1.0.0");
    expect(body.platform).toBe("web");
  });

  it("should deduplicate same error within 60s", () => {
    reporter.report({ message: "dup error" });
    reporter.report({ message: "dup error" });
    jest.advanceTimersByTime(5000);
    // Only one POST call (dedup dropped the second)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should drop oldest errors when queue exceeds 50", () => {
    for (let i = 0; i < 55; i++) {
      reporter.report({ message: `error-${i}` });
    }
    jest.advanceTimersByTime(5000);
    // 50 individual POST calls (one per error)
    expect(mockFetch).toHaveBeenCalledTimes(50);
    const firstBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(firstBody.message).toBe("error-5");
  });

  it("should track current screen", () => {
    reporter.setCurrentScreen("HomeScreen");
    reporter.report({ message: "screen error" });
    jest.advanceTimersByTime(5000);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body[0].screen).toBe("HomeScreen");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/client-sdk/__tests__/reporter.spec.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement core reporter**

```typescript
// src/client-sdk/reporter.ts
interface ReporterConfig {
  apiUrl: string;
  appVersion: string;
  platform: "web" | "ios" | "android";
  userId?: string;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  dedupWindowMs?: number;
}

interface ErrorEntry {
  message: string;
  stack?: string;
  screen?: string;
  userAgent?: string;
  userId?: string;
  lastActions?: string[];
  metadata?: Record<string, unknown>;
}

interface ClientErrorPayload extends ErrorEntry {
  platform: string;
  appVersion: string;
}

const MAX_RETRIES = 3;

export class ErrorReporter {
  private queue: ClientErrorPayload[] = [];
  private recentKeys = new Map<string, number>();
  private currentScreen?: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly config: Required<
    Pick<ReporterConfig, "flushIntervalMs" | "maxQueueSize" | "dedupWindowMs">
  > &
    ReporterConfig;

  constructor(config: ReporterConfig) {
    this.config = {
      flushIntervalMs: 5000,
      maxQueueSize: 50,
      dedupWindowMs: 60000,
      ...config,
    };
    this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
  }

  report(entry: ErrorEntry): void {
    const dedupKey = entry.message + (entry.stack ?? "");
    const now = Date.now();
    const lastSeen = this.recentKeys.get(dedupKey);
    if (lastSeen && now - lastSeen < this.config.dedupWindowMs) return;
    this.recentKeys.set(dedupKey, now);

    const payload: ClientErrorPayload = {
      ...entry,
      platform: this.config.platform,
      appVersion: this.config.appVersion,
      screen: entry.screen ?? this.currentScreen,
      userId: entry.userId ?? this.config.userId,
    };

    this.queue.push(payload);
    if (this.queue.length > this.config.maxQueueSize) {
      this.queue = this.queue.slice(this.queue.length - this.config.maxQueueSize);
    }
  }

  setCurrentScreen(name: string): void {
    this.currentScreen = name;
  }

  setUserId(id: string): void {
    this.config.userId = id;
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    for (const payload of batch) {
      await this.sendWithRetry(payload, 0);
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async sendWithRetry(payload: ClientErrorPayload, attempt: number): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiUrl}/client-errors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      if (!response.ok && attempt < MAX_RETRIES) {
        await this.delay(Math.pow(2, attempt) * 1000);
        return this.sendWithRetry(payload, attempt + 1);
      }
    } catch {
      if (attempt < MAX_RETRIES) {
        await this.delay(Math.pow(2, attempt) * 1000);
        return this.sendWithRetry(payload, attempt + 1);
      }
      // Silent drop after max retries
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 4: Implement web adapter**

```typescript
// src/client-sdk/web.ts
import { ErrorReporter } from "./reporter";

let _reporter: ErrorReporter | null = null;

export function initErrorReporter(config: {
  apiUrl: string;
  appVersion: string;
  userId?: string;
}): ErrorReporter {
  _reporter = new ErrorReporter({ ...config, platform: "web" });

  window.onerror = (message, source, lineno, colno, error) => {
    _reporter?.report({
      message: String(message),
      stack: error?.stack ?? `${source}:${lineno}:${colno}`,
      userAgent: navigator.userAgent,
    });
  };

  window.onunhandledrejection = (event) => {
    const error = event.reason;
    _reporter?.report({
      message: error?.message ?? String(error),
      stack: error?.stack,
      userAgent: navigator.userAgent,
    });
  };

  return _reporter;
}

export function reportError(
  error: Error,
  context?: { screen?: string; metadata?: Record<string, unknown> },
): void {
  _reporter?.report({
    message: error.message,
    stack: error.stack,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    ...context,
  });
}

export { ErrorReporter } from "./reporter";
```

- [ ] **Step 5: Implement React adapter**

```typescript
// src/client-sdk/react.ts
import { ErrorReporter } from "./reporter";

// React types inlined to avoid dependency
type ReactNode = any;

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  reporter?: ErrorReporter;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

let _sharedReporter: ErrorReporter | null = null;

export function setSharedReporter(reporter: ErrorReporter): void {
  _sharedReporter = reporter;
}

// Factory to avoid direct React import at module level
export function createErrorBoundary(React: any) {
  return class SoameeErrorBoundary extends React.Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
  > {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
      return { hasError: true };
    }

    componentDidCatch(error: Error, info: { componentStack?: string }) {
      const reporter = this.props.reporter ?? _sharedReporter;
      reporter?.report({
        message: error.message,
        stack: error.stack ?? info.componentStack ?? undefined,
      });
    }

    render() {
      if (this.state.hasError) return this.props.fallback;
      return this.props.children;
    }
  };
}

export function useErrorReporter(reporter?: ErrorReporter) {
  const active = reporter ?? _sharedReporter;
  return {
    reportError: (error: Error, context?: { screen?: string }) => {
      active?.report({
        message: error.message,
        stack: error.stack,
        ...context,
      });
    },
  };
}

export { ErrorReporter } from "./reporter";
```

- [ ] **Step 6: Implement React Native adapter**

```typescript
// src/client-sdk/react-native.ts
import { ErrorReporter } from "./reporter";

let _reporter: ErrorReporter | null = null;

export function initErrorReporter(config: {
  apiUrl: string;
  appVersion: string;
  userId?: string;
}): ErrorReporter {
  // Detect platform at runtime
  let platform: "ios" | "android" = "ios";
  try {
    const { Platform } = require("react-native");
    platform = Platform.OS === "android" ? "android" : "ios";
  } catch {
    // Fallback to ios
  }

  _reporter = new ErrorReporter({ ...config, platform });

  // Hook into React Native's global error handler
  try {
    const ErrorUtils = (globalThis as any).ErrorUtils;
    if (ErrorUtils) {
      const prevHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        _reporter?.report({
          message: error.message,
          stack: error.stack,
          metadata: { isFatal },
        });
        prevHandler?.(error, isFatal);
      });
    }
  } catch {
    // ErrorUtils not available
  }

  // Hook unhandled promise rejections
  const tracking = require("promise/setimmediate/rejection-tracking");
  if (tracking) {
    try {
      tracking.enable({
        allRejections: true,
        onUnhandled: (_id: number, error: Error) => {
          _reporter?.report({
            message: error?.message ?? String(error),
            stack: error?.stack,
          });
        },
      });
    } catch {
      // Rejection tracking not available
    }
  }

  return _reporter;
}

export function reportError(
  error: Error,
  context?: { screen?: string; metadata?: Record<string, unknown> },
): void {
  _reporter?.report({
    message: error.message,
    stack: error.stack,
    ...context,
  });
}

export function setCurrentScreen(name: string): void {
  _reporter?.setCurrentScreen(name);
}

export { ErrorReporter } from "./reporter";
```

- [ ] **Step 7: Create SDK index**

```typescript
// src/client-sdk/index.ts
export { ErrorReporter } from "./reporter";
export { initErrorReporter as initWebErrorReporter, reportError as reportWebError } from "./web";
export { createErrorBoundary, setSharedReporter, useErrorReporter } from "./react";
export {
  initErrorReporter as initRNErrorReporter,
  reportError as reportRNError,
  setCurrentScreen,
} from "./react-native";
```

- [ ] **Step 8: Run reporter tests**

Run: `npx jest src/client-sdk/__tests__/reporter.spec.ts --no-coverage`
Expected: PASS — 4 tests

- [ ] **Step 9: Commit**

```bash
git add src/client-sdk/
git commit -m "feat(client-sdk): add error reporter for web, React, and React Native"
```

---

### Task 6: CLI Upload Tool + Package Config

**Files:**
- Create: `src/cli/upload-sourcemaps.ts`
- Modify: `package.json` — add `exports`, `bin`, `source-map` dep, `@aws-sdk/client-s3` peer dep, `class-validator` + `class-transformer` peer deps
- Test: `src/cli/__tests__/upload-sourcemaps.spec.ts`

**Interfaces:**
- Consumes: `POST /client-errors/sourcemaps` endpoint (Task 4)
- Produces: `npx @soamee/exceptions-filter upload-sourcemaps` CLI command

- [ ] **Step 1: Write the CLI test**

```typescript
// src/cli/__tests__/upload-sourcemaps.spec.ts
import { parseArgs, findSourceMaps } from "../upload-sourcemaps";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("upload-sourcemaps CLI", () => {
  describe("parseArgs", () => {
    it("should parse all required arguments", () => {
      const args = parseArgs([
        "--version=1.0.0",
        "--platform=web",
        "--dir=./dist",
        "--api-url=https://api.test.com",
        "--api-key=secret",
      ]);
      expect(args).toEqual({
        version: "1.0.0",
        platform: "web",
        dir: "./dist",
        apiUrl: "https://api.test.com",
        apiKey: "secret",
        clean: false,
      });
    });

    it("should parse --clean flag", () => {
      const args = parseArgs([
        "--version=1.0.0",
        "--platform=web",
        "--dir=./dist",
        "--api-url=https://api.test.com",
        "--api-key=secret",
        "--clean",
      ]);
      expect(args.clean).toBe(true);
    });

    it("should throw on missing required args", () => {
      expect(() => parseArgs(["--version=1.0.0"])).toThrow();
    });
  });

  describe("findSourceMaps", () => {
    it("should find .map files recursively", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "maps-"));
      const sub = path.join(tmpDir, "sub");
      fs.mkdirSync(sub);
      fs.writeFileSync(path.join(tmpDir, "a.js.map"), "{}");
      fs.writeFileSync(path.join(sub, "b.js.map"), "{}");
      fs.writeFileSync(path.join(tmpDir, "c.js"), "code");

      const maps = findSourceMaps(tmpDir);
      expect(maps).toHaveLength(2);
      expect(maps.every((f) => f.endsWith(".map"))).toBe(true);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/cli/__tests__/upload-sourcemaps.spec.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the CLI**

```typescript
#!/usr/bin/env node
// src/cli/upload-sourcemaps.ts
import * as fs from "fs";
import * as path from "path";

interface CliArgs {
  version: string;
  platform: string;
  dir: string;
  apiUrl: string;
  apiKey: string;
  clean: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  let clean = false;

  for (const arg of argv) {
    if (arg === "--clean") {
      clean = true;
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) {
      args[match[1]] = match[2];
    }
  }

  const required = ["version", "platform", "dir", "api-url", "api-key"];
  for (const key of required) {
    if (!args[key]) {
      throw new Error(`Missing required argument: --${key}`);
    }
  }

  return {
    version: args["version"],
    platform: args["platform"],
    dir: args["dir"],
    apiUrl: args["api-url"],
    apiKey: args["api-key"],
    clean,
  };
}

export function findSourceMaps(dir: string): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    for (const entry of fs.readdirSync(current)) {
      const full = path.join(current, entry);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".map")) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

async function uploadFile(
  filePath: string,
  config: CliArgs,
): Promise<void> {
  const content = fs.readFileSync(filePath);
  const filename = path.basename(filePath);

  const formData = new FormData();
  formData.append("file", new Blob([content]), filename);
  formData.append("platform", config.platform);
  formData.append("version", config.version);

  const response = await fetch(`${config.apiUrl}/client-errors/sourcemaps`, {
    method: "POST",
    headers: { "x-sourcemap-api-key": config.apiKey },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload ${filename}: ${response.status} ${response.statusText}`);
  }
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  const maps = findSourceMaps(config.dir);

  if (maps.length === 0) {
    console.log(`No .map files found in ${config.dir}`);
    return;
  }

  console.log(`Found ${maps.length} source map(s) for ${config.platform}@${config.version}`);

  let uploaded = 0;
  for (const mapFile of maps) {
    await uploadFile(mapFile, config);
    uploaded++;
    console.log(`  [${uploaded}/${maps.length}] ${path.basename(mapFile)}`);
  }

  if (config.clean) {
    for (const mapFile of maps) {
      fs.unlinkSync(mapFile);
    }
    console.log(`Cleaned ${maps.length} .map file(s) from ${config.dir}`);
  }

  console.log(`Uploaded ${uploaded}/${maps.length} source maps for ${config.platform}@${config.version}`);
}

// Only run main when executed directly, not when imported for tests
if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run CLI tests**

Run: `npx jest src/cli/__tests__/upload-sourcemaps.spec.ts --no-coverage`
Expected: PASS — 4 tests

- [ ] **Step 5: Update package.json**

Add to `package.json`:
- `"exports"` field with subpath entries (`.`, `./client`, `./client/web`, `./client/react`, `./client/react-native`)
- `"bin": { "upload-sourcemaps": "./dist/cli/upload-sourcemaps.js" }`
- Add `"source-map": "^0.7.4"` to `dependencies`
- Add `"@aws-sdk/client-s3": ">=3.0.0"` to `peerDependenciesMeta` (optional)
- Add `"class-validator": ">=0.14.0"` and `"class-transformer": ">=0.5.0"` to `peerDependenciesMeta` (optional)
- Add `"@nestjs/platform-express": ">=9.0.0"` to `peerDependenciesMeta` (optional)
- Bump version to `2.0.0` (breaking: new subpath exports)

- [ ] **Step 6: Build and verify**

Run: `npm run build`
Expected: Compiles without errors

- [ ] **Step 7: Commit**

```bash
git add src/cli/ package.json
git commit -m "feat(cli): add upload-sourcemaps CLI tool and update package config"
```

---

### Task 7: Integration Test + README

**Files:**
- Create: `src/__tests__/client-errors-integration.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: Everything from Tasks 1-6
- Produces: Verified end-to-end flow, updated documentation

- [ ] **Step 1: Write integration test**

```typescript
// src/__tests__/client-errors-integration.spec.ts
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
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
```

- [ ] **Step 2: Install supertest dev dep**

Run: `npm install --save-dev supertest @types/supertest`

- [ ] **Step 3: Run integration test**

Run: `npx jest src/__tests__/client-errors-integration.spec.ts --no-coverage`
Expected: PASS — 4 tests

- [ ] **Step 4: Update README.md**

Add a new section `## Client Error Reporting` to the existing README covering:
- Quick start for backend (`ClientErrorsModule.register(...)`)
- Quick start for web (`initErrorReporter(...)`)
- Quick start for React (`SoameeErrorBoundary`)
- Quick start for React Native (`initErrorReporter(...)`, `setCurrentScreen(...)`)
- CLI usage (`npx upload-sourcemaps`)
- CI/CD GitHub Actions example

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 7: Commit and tag**

```bash
git add .
git commit -m "feat: add client error reporting with source maps (v2.0.0)

- Backend module: POST /client-errors with source map resolution
- Client SDK: web, React, React Native error capture
- CLI: upload-sourcemaps for CI/CD
- Storage adapters: S3 and local filesystem
- Integration tests and documentation"
git tag v2.0.0
```
