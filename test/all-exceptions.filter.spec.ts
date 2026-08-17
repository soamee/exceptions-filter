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

  describe("notification policy", () => {
    const created = {
      id: "policy-1",
      exceptionMessage: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    function notificationConfig(overrides: Partial<ExceptionsFilterConfig>) {
      return createConfig({
        persistence: {
          findDuplicate: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(created),
        },
        enableThrottling: false,
        ...overrides,
      });
    }

    it("includes notifications by HTTP status, severity, method, and path", async () => {
      const onError = jest.fn();
      const config = notificationConfig({
        onError,
        notificationPolicy: {
          include: [{ statuses: [503], severities: ["error"], methods: ["post"], paths: ["/api/jobs"] }],
        },
      });

      await new AllExceptionsFilter(config).catch(
        new HttpException("Unavailable", 503),
        createMockHost({ method: "POST", url: "/api/jobs/42" }),
      );

      expect(onError).toHaveBeenCalledWith(created);
    });

    it("excludes matching routes from both callbacks and email", async () => {
      const onError = jest.fn();
      const sendNotification = jest.fn();
      const config = notificationConfig({
        onError,
        emailNotification: {
          enabled: true,
          toEmails: ["ops@example.com"],
          adapter: { sendNotification },
        },
        notificationPolicy: { exclude: [{ paths: [/^\/health(?:\/|$)/] }] },
      });

      await new AllExceptionsFilter(config).catch(
        new Error("Health dependency failed"),
        createMockHost({ url: "/health/ready" }),
      );

      expect(onError).not.toHaveBeenCalled();
      expect(sendNotification).not.toHaveBeenCalled();
    });

    it("gives exclusions precedence over includes and the custom decision", async () => {
      const onError = jest.fn();
      const decide = jest.fn().mockReturnValue(true);
      const config = notificationConfig({
        onError,
        notificationPolicy: {
          include: [{ severities: ["error"] }],
          exclude: [{ methods: ["GET"] }],
          decide,
        },
      });

      await new AllExceptionsFilter(config).catch(new Error("Test"), createMockHost());

      expect(onError).not.toHaveBeenCalled();
      expect(decide).not.toHaveBeenCalled();
    });

    it("fails closed and logs when the custom decision throws", async () => {
      const onError = jest.fn();
      const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
      const config = notificationConfig({
        onError,
        logger,
        notificationPolicy: { decide: () => { throw new Error("decision boom"); } },
      });

      await new AllExceptionsFilter(config).catch(new Error("Test"), createMockHost());

      expect(onError).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "AllExceptionsFilter",
        expect.stringContaining("notificationPolicy decision failed"),
      );
    });

    it("passes only sanitized request data to the custom decision", async () => {
      const decide = jest.fn().mockReturnValue(false);
      const config = notificationConfig({ notificationPolicy: { decide } });

      await new AllExceptionsFilter(config).catch(
        new Error("Test"),
        createMockHost({
          headers: { authorization: "Bearer secret", "user-agent": "browser" },
          body: { password: "secret", safe: "value" },
          query: { token: "secret" },
        }),
      );

      expect(decide).toHaveBeenCalledWith(expect.objectContaining({
        exception: expect.objectContaining({ name: "Error", message: "Test" }),
        request: expect.objectContaining({
          headers: expect.objectContaining({ authorization: "[REDACTED]" }),
          body: { password: "******", safe: "value" },
          query: { token: "******" },
        }),
        record: created,
        status: 500,
        severity: "error",
        crawler: expect.objectContaining({ isCrawler: false }),
      }));
    });

    it("keeps existing configurations notifying without a policy", async () => {
      const onError = jest.fn();
      const config = notificationConfig({ onError });

      await new AllExceptionsFilter(config).catch(new Error("Test"), createMockHost());

      expect(onError).toHaveBeenCalledWith(created);
    });
  });

  describe("knownRoutePrefixes", () => {
    it("should NOT skip errors matching a known route prefix even if skip pattern matches", async () => {
      const created = { id: "new-1", exceptionMessage: "Test", createdAt: new Date(), updatedAt: new Date() };
      const persistence = { findDuplicate: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) };
      const config = createConfig({
        persistence,
        enableThrottling: false,
        autoDetectRoutes: false,
        knownRoutePrefixes: ["/api/v1"],
      });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      // "/api/v1/upload" would normally match upload skip pattern but
      // /api/v1 is a known prefix → should NOT skip
      await filter.catch(new Error("Cannot POST /api/v1/upload"), host);

      expect(persistence.create).toHaveBeenCalled();
    });

    it("should still skip errors for non-known routes", async () => {
      const persistence = { findDuplicate: jest.fn(), create: jest.fn() };
      const config = createConfig({
        persistence,
        autoDetectRoutes: false,
        knownRoutePrefixes: ["/api/v1"],
      });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      // wp-admin not under /api/v1 → skip as normal
      await filter.catch(new Error("Cannot GET /wp-admin/"), host);

      expect(persistence.create).not.toHaveBeenCalled();
    });

    it("should work without knownRoutePrefixes (backwards compatible)", async () => {
      const persistence = { findDuplicate: jest.fn(), create: jest.fn() };
      const config = createConfig({ persistence, autoDetectRoutes: false });
      const filter = new AllExceptionsFilter(config);
      const host = createMockHost();

      await filter.catch(new Error("Cannot GET /wp-admin/"), host);

      expect(persistence.create).not.toHaveBeenCalled();
    });
  });

  describe("autoDetectRoutes", () => {
    function createMockHttpAdapterHost(routes: Array<{ path: string; methods: Record<string, boolean> }>) {
      const stack = routes.map(r => ({
        route: { path: r.path, methods: r.methods },
      }));
      return {
        httpAdapter: {
          getInstance: () => ({
            _router: { stack },
          }),
        },
      } as any;
    }

    it("should auto-detect routes and protect them from skip patterns", async () => {
      const created = { id: "new-1", exceptionMessage: "Test", createdAt: new Date(), updatedAt: new Date() };
      const persistence = { findDuplicate: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) };
      const config = createConfig({ persistence, enableThrottling: false });
      const httpAdapterHost = createMockHttpAdapterHost([
        { path: "/api/v1/users", methods: { get: true, post: true } },
        { path: "/api/v1/upload", methods: { post: true } },
      ]);
      const filter = new AllExceptionsFilter(config, httpAdapterHost);
      const host = createMockHost();

      // /api/v1/upload would match upload skip pattern but is auto-detected route
      await filter.catch(new Error("Cannot POST /api/v1/upload"), host);

      expect(persistence.create).toHaveBeenCalled();
    });

    it("should not auto-detect when autoDetectRoutes is false", async () => {
      const persistence = { findDuplicate: jest.fn(), create: jest.fn() };
      const config = createConfig({ persistence, autoDetectRoutes: false });
      const httpAdapterHost = createMockHttpAdapterHost([
        { path: "/api/v1/upload", methods: { post: true } },
      ]);
      const filter = new AllExceptionsFilter(config, httpAdapterHost);
      const host = createMockHost();

      // /wp-admin/ matches skip patterns → should be skipped regardless of auto-detect
      await filter.catch(new Error("Cannot GET /wp-admin/"), host);

      expect(persistence.create).not.toHaveBeenCalled();
    });

    it("should merge manual and auto-detected prefixes", async () => {
      const created = { id: "new-1", exceptionMessage: "Test", createdAt: new Date(), updatedAt: new Date() };
      const persistence = { findDuplicate: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) };
      const config = createConfig({
        persistence,
        enableThrottling: false,
        knownRoutePrefixes: ["/webhooks"],
      });
      const httpAdapterHost = createMockHttpAdapterHost([
        { path: "/api/v1/users", methods: { get: true } },
      ]);
      const filter = new AllExceptionsFilter(config, httpAdapterHost);
      const host = createMockHost();

      // /webhooks is manual prefix, should be protected
      await filter.catch(new Error("Cannot POST /webhooks/stripe"), host);

      expect(persistence.create).toHaveBeenCalled();
    });

    it("should handle missing httpAdapterHost gracefully", async () => {
      const persistence = { findDuplicate: jest.fn(), create: jest.fn() };
      const config = createConfig({ persistence });
      const filter = new AllExceptionsFilter(config); // no httpAdapterHost
      const host = createMockHost();

      await filter.catch(new Error("Cannot GET /wp-admin/"), host);

      expect(persistence.create).not.toHaveBeenCalled();
    });

    it("should handle httpAdapterHost with no getInstance", async () => {
      const persistence = { findDuplicate: jest.fn(), create: jest.fn() };
      const config = createConfig({ persistence });
      const httpAdapterHost = { httpAdapter: {} } as any;
      const filter = new AllExceptionsFilter(config, httpAdapterHost);
      const host = createMockHost();

      await filter.catch(new Error("Cannot GET /wp-admin/"), host);

      expect(persistence.create).not.toHaveBeenCalled();
    });

    it("should handle httpAdapterHost with no _router", async () => {
      const persistence = { findDuplicate: jest.fn(), create: jest.fn() };
      const config = createConfig({ persistence });
      const httpAdapterHost = { httpAdapter: { getInstance: () => ({}) } } as any;
      const filter = new AllExceptionsFilter(config, httpAdapterHost);
      const host = createMockHost();

      await filter.catch(new Error("Cannot GET /wp-admin/"), host);

      expect(persistence.create).not.toHaveBeenCalled();
    });

    it("should cache detected routes (only detect once)", async () => {
      const created = { id: "new-1", exceptionMessage: "Test", createdAt: new Date(), updatedAt: new Date() };
      const persistence = { findDuplicate: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) };
      const config = createConfig({ persistence, enableThrottling: false });
      const getInstance = jest.fn().mockReturnValue({
        _router: { stack: [{ route: { path: "/api/v1/users", methods: { get: true } } }] },
      });
      const httpAdapterHost = { httpAdapter: { getInstance } } as any;
      const filter = new AllExceptionsFilter(config, httpAdapterHost);

      const host1 = createMockHost();
      const host2 = createMockHost();
      await filter.catch(new Error("Cannot POST /api/v1/upload"), host1);
      await filter.catch(new Error("Cannot POST /api/v1/upload"), host2);

      // getInstance called only once due to caching
      expect(getInstance).toHaveBeenCalledTimes(1);
    });

    it("should detect routes from nested routers with basePath", async () => {
      const created = { id: "new-1", exceptionMessage: "Test", createdAt: new Date(), updatedAt: new Date() };
      const persistence = { findDuplicate: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) };
      const config = createConfig({ persistence, enableThrottling: false });
      const httpAdapterHost = {
        httpAdapter: {
          getInstance: () => ({
            _router: {
              stack: [
                {
                  name: "router",
                  regexp: /^\/api\/v1\/?(?=\/|$)/i,
                  handle: {
                    stack: [
                      { route: { path: "/users", methods: { get: true } } },
                      { route: { path: "/products/:id", methods: { get: true } } },
                    ],
                  },
                },
              ],
            },
          }),
        },
      } as any;
      const filter = new AllExceptionsFilter(config, httpAdapterHost);
      const host = createMockHost();

      // /api/v1/users detected from nested router → /api/v1 prefix protected
      await filter.catch(new Error("Cannot POST /api/v1/upload"), host);

      expect(persistence.create).toHaveBeenCalled();
    });

    it("should not protect non-project routes when project routes are detected", async () => {
      const persistence = { findDuplicate: jest.fn(), create: jest.fn() };
      const config = createConfig({ persistence });
      const httpAdapterHost = createMockHttpAdapterHost([
        { path: "/api/v1/users", methods: { get: true } },
      ]);
      const filter = new AllExceptionsFilter(config, httpAdapterHost);
      const host = createMockHost();

      // /wp-admin is NOT under any detected prefix → still skipped
      await filter.catch(new Error("Cannot GET /wp-admin/"), host);

      expect(persistence.create).not.toHaveBeenCalled();
    });

    it("should handle routes at root level like /health", async () => {
      const created = { id: "new-1", exceptionMessage: "Test", createdAt: new Date(), updatedAt: new Date() };
      const persistence = { findDuplicate: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(created) };
      const config = createConfig({ persistence, enableThrottling: false });
      const httpAdapterHost = createMockHttpAdapterHost([
        { path: "/health", methods: { get: true } },
        { path: "/api/v1/users", methods: { get: true } },
      ]);
      const filter = new AllExceptionsFilter(config, httpAdapterHost);
      const host = createMockHost();

      // /health is auto-detected → protected from "health check" skip pattern
      await filter.catch(new Error("Cannot GET /health"), host);

      expect(persistence.create).toHaveBeenCalled();
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
