import { AllExceptionsFilter } from "../src/all-exceptions.filter";
import { HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import type { ExceptionsFilterConfig } from "../src/interfaces";

function createMockHost(overrides: Record<string, unknown> = {}): ArgumentsHost {
  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockRequest = {
    url: "/test",
    method: "GET",
    ip: "127.0.0.1",
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      "accept-language": "en-US",
      "accept-encoding": "gzip",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
    },
    body: {},
    query: {},
    ...overrides,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => ({ status: mockStatus }),
    }),
    getArgs: () => [],
    getArgByIndex: () => null,
    switchToRpc: () => ({} as any),
    switchToWs: () => ({} as any),
    getType: () => "http" as any,
  } as unknown as ArgumentsHost;
}

function getResponseFromHost(host: ArgumentsHost) {
  const res = host.switchToHttp().getResponse<any>();
  return {
    status: res.status,
    json: res.status.mock.results[0]?.value?.json,
  };
}

function createConfig(overrides: Partial<ExceptionsFilterConfig> = {}): ExceptionsFilterConfig {
  return {
    appName: "test-app",
    appEnvironment: "test",
    ...overrides,
  };
}

describe("AllExceptionsFilter", () => {
  describe("basic error handling", () => {
    it("should return 500 for unknown errors with hidden message by default", async () => {
      const config = createConfig();
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      await filter.catch(new Error("Something broke"), host);

      const { status, json } = getResponseFromHost(host);
      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          error: "Internal error occurred",
          message: "Internal server error",
        }),
      );
    });

    it("should preserve HttpException status and message", async () => {
      const config = createConfig();
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      await filter.catch(new HttpException("Not Found", HttpStatus.NOT_FOUND), host);

      const { status, json } = getResponseFromHost(host);
      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: "Not Found",
        }),
      );
    });

    it("should hide internal error message when hideInternalErrors is true", async () => {
      const config = createConfig({ hideInternalErrors: true });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      await filter.catch(new Error("Prisma column xyz not found"), host);

      const { json } = getResponseFromHost(host);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Internal server error",
        }),
      );
    });

    it("should expose error message when hideInternalErrors is false", async () => {
      const config = createConfig({ hideInternalErrors: false });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      await filter.catch(new Error("Prisma column xyz not found"), host);

      const { json } = getResponseFromHost(host);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Prisma column xyz not found",
        }),
      );
    });
  });

  describe("skip methods", () => {
    it("should early-return for HEAD requests", async () => {
      const persistence = { findDuplicate: jest.fn(), create: jest.fn() };
      const config = createConfig({ persistence });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost({ method: "HEAD" });

      await filter.catch(new Error("test"), host);

      expect(persistence.findDuplicate).not.toHaveBeenCalled();
      expect(persistence.create).not.toHaveBeenCalled();
    });

    it("should early-return for MKCOL requests", async () => {
      const persistence = { findDuplicate: jest.fn(), create: jest.fn() };
      const config = createConfig({ persistence });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost({ method: "MKCOL" });

      await filter.catch(new Error("test"), host);

      expect(persistence.create).not.toHaveBeenCalled();
    });
  });

  describe("skip patterns", () => {
    it("should skip DB persistence for matched patterns", async () => {
      const persistence = { findDuplicate: jest.fn(), create: jest.fn() };
      const config = createConfig({ persistence });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      await filter.catch(new Error("Cannot GET /wp-admin/"), host);

      expect(persistence.findDuplicate).not.toHaveBeenCalled();
      expect(persistence.create).not.toHaveBeenCalled();
    });

    it("should skip DB for extra patterns", async () => {
      const persistence = { findDuplicate: jest.fn(), create: jest.fn() };
      const config = createConfig({
        persistence,
        extraSkipPatterns: [/^CUSTOM_SKIP/i],
      });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      await filter.catch(new Error("CUSTOM_SKIP_ERROR"), host);

      expect(persistence.create).not.toHaveBeenCalled();
    });
  });

  describe("throttling", () => {
    it("should throttle repeated errors from same IP", async () => {
      const persistence = { findDuplicate: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "1", exceptionMessage: "x", createdAt: new Date(), updatedAt: new Date() }) };
      const config = createConfig({ persistence, enableThrottling: true, throttleMs: 5000 });
      const filter = new AllExceptionsFilter(config);
      const host1 = createMockHost();
      const host2 = createMockHost();

      await filter.catch(new Error("Real error"), host1);
      await filter.catch(new Error("Real error"), host2);

      // First call persists, second is throttled
      expect(persistence.create).toHaveBeenCalledTimes(1);
    });

    it("should not throttle when disabled", async () => {
      const persistence = { findDuplicate: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "1", exceptionMessage: "x", createdAt: new Date(), updatedAt: new Date() }) };
      const config = createConfig({ persistence, enableThrottling: false });
      const filter = new AllExceptionsFilter(config);
      const host1 = createMockHost();
      const host2 = createMockHost();

      await filter.catch(new Error("Real error"), host1);
      await filter.catch(new Error("Real error"), host2);

      expect(persistence.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("deduplication", () => {
    it("should skip create when duplicate found", async () => {
      const existing = { id: "existing-1", exceptionMessage: "Dup", createdAt: new Date(), updatedAt: new Date() };
      const persistence = { findDuplicate: jest.fn().mockResolvedValue(existing), create: jest.fn() };
      const config = createConfig({ persistence, enableThrottling: false });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      await filter.catch(new Error("Dup"), host);

      expect(persistence.findDuplicate).toHaveBeenCalled();
      expect(persistence.create).not.toHaveBeenCalled();
    });
  });

  describe("onError callback", () => {
    it("should call onError when error is persisted", async () => {
      const created = { id: "new-1", exceptionMessage: "Test", createdAt: new Date(), updatedAt: new Date() };
      const persistence = { findDuplicate: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) };
      const onError = jest.fn().mockResolvedValue(undefined);
      const config = createConfig({ persistence, onError, enableThrottling: false });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      await filter.catch(new Error("Test"), host);

      expect(onError).toHaveBeenCalledWith(created);
    });

    it("should not call onError for skipped exceptions", async () => {
      const onError = jest.fn();
      const config = createConfig({ onError });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      await filter.catch(new Error("Cannot GET /wp-admin/"), host);

      expect(onError).not.toHaveBeenCalled();
    });

    it("should not call onError when crawler detected", async () => {
      const created = { id: "new-1", exceptionMessage: "Test", createdAt: new Date(), updatedAt: new Date() };
      const persistence = { findDuplicate: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) };
      const onError = jest.fn();
      const config = createConfig({ persistence, onError, enableCrawlerDetection: true, enableThrottling: false });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost({ headers: { "user-agent": "Googlebot/2.1" } });

      await filter.catch(new Error("Test"), host);

      expect(persistence.create).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("error response shape", () => {
    it("should include errorId when persisted", async () => {
      const created = { id: "err-123", exceptionMessage: "Test", createdAt: new Date(), updatedAt: new Date() };
      const persistence = { findDuplicate: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) };
      const config = createConfig({ persistence, enableThrottling: false });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      await filter.catch(new Error("Test"), host);

      const { json } = getResponseFromHost(host);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ errorId: "err-123" }),
      );
    });
  });
});
