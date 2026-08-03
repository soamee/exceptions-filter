import {
  botSkipPatterns,
  userErrorSkipPatterns,
  attackSkipPatterns,
  allBaseSkipPatterns,
  shouldSkipException,
} from "../../src/skip-patterns";

describe("skip patterns", () => {
  describe("botSkipPatterns", () => {
    it("should match WordPress probes", () => {
      expect(botSkipPatterns.some((p) => p.test("Cannot GET /wp-login.php"))).toBe(true);
      expect(botSkipPatterns.some((p) => p.test("Cannot GET /wp-admin/"))).toBe(true);
    });

    it("should match generic GET probes", () => {
      expect(botSkipPatterns.some((p) => p.test("Cannot GET /some/random/path"))).toBe(true);
    });

    it("should match POST to root", () => {
      expect(botSkipPatterns.some((p) => p.test("Cannot POST /"))).toBe(true);
    });
  });

  describe("userErrorSkipPatterns", () => {
    it("should match auth errors", () => {
      expect(userErrorSkipPatterns.some((p) => p.test("Unauthorized"))).toBe(true);
      expect(userErrorSkipPatterns.some((p) => p.test("INCORRECT_USER_PASSWORD"))).toBe(true);
    });

    it("should match not-found errors", () => {
      expect(userErrorSkipPatterns.some((p) => p.test("USER_NOT_FOUND"))).toBe(true);
      expect(userErrorSkipPatterns.some((p) => p.test("CONTENT_NOT_FOUND"))).toBe(true);
    });
  });

  describe("attackSkipPatterns", () => {
    it("should match SQL injection", () => {
      expect(attackSkipPatterns.some((p) => p.test("UNION SELECT * FROM users"))).toBe(true);
    });

    it("should match XSS attempts", () => {
      expect(attackSkipPatterns.some((p) => p.test("<script>alert(1)</script>"))).toBe(true);
    });

    it("should match path traversal", () => {
      expect(attackSkipPatterns.some((p) => p.test("../../etc/passwd"))).toBe(true);
    });
  });

  describe("shouldSkipException", () => {
    it("should return true for matching base pattern", () => {
      expect(shouldSkipException("Cannot GET /wp-admin/")).toBe(true);
    });

    it("should return false for legitimate errors", () => {
      expect(shouldSkipException("Cannot read property 'id' of undefined")).toBe(false);
    });

    it("should match extra patterns", () => {
      const extra = [/^MY_CUSTOM_SKIP/i];
      expect(shouldSkipException("MY_CUSTOM_SKIP_ERROR", extra)).toBe(true);
    });

    it("should not match extra patterns for unrelated messages", () => {
      const extra = [/^MY_CUSTOM_SKIP/i];
      expect(shouldSkipException("SOME_OTHER_ERROR", extra)).toBe(false);
    });
  });

  describe("knownRoutePrefixes protection", () => {
    // === Core protection: known routes must NEVER be skipped ===

    // The biggest shadowing risk: botSkipPatterns has a catch-all
    // /^Cannot GET \/.*$/i that matches ALL "Cannot GET" routes.
    // knownRoutePrefixes must override this for project routes.

    it("should NOT skip GET errors on known routes (overrides catch-all GET pattern)", () => {
      // Without protection: catch-all /^Cannot GET \/.*$/i matches everything
      expect(shouldSkipException("Cannot GET /api/v1/users")).toBe(true);
      // With protection: /api/v1 is known → NOT skipped
      expect(shouldSkipException("Cannot GET /api/v1/users", [], ["/api/v1"])).toBe(false);
    });

    it("should NOT skip errors on known /health route", () => {
      // /health matches both catch-all GET and attackSkipPatterns health check pattern
      expect(shouldSkipException("Cannot GET /health")).toBe(true);
      expect(shouldSkipException("Cannot GET /health", [], ["/health"])).toBe(false);
    });

    it("should NOT skip errors on known /status route", () => {
      expect(shouldSkipException("Cannot GET /status")).toBe(true);
      expect(shouldSkipException("Cannot GET /status", [], ["/status"])).toBe(false);
    });

    it("should NOT skip errors on known /metrics route", () => {
      expect(shouldSkipException("Cannot GET /metrics")).toBe(true);
      expect(shouldSkipException("Cannot GET /metrics", [], ["/metrics"])).toBe(false);
    });

    it("should NOT skip errors on known /console route", () => {
      expect(shouldSkipException("Cannot GET /console")).toBe(true);
      expect(shouldSkipException("Cannot GET /console", [], ["/console"])).toBe(false);
    });

    it("should NOT skip errors on known /admin route", () => {
      expect(shouldSkipException("Cannot POST /admin")).toBe(true);
      expect(shouldSkipException("Cannot POST /admin", [], ["/admin"])).toBe(false);
    });

    it("should NOT skip errors on known /login route", () => {
      expect(shouldSkipException("Cannot POST /login")).toBe(true);
      expect(shouldSkipException("Cannot POST /login", [], ["/login"])).toBe(false);
    });

    // === Scanner routes must STILL be skipped ===

    it("should still skip /wp-admin even with known prefixes", () => {
      expect(shouldSkipException("Cannot GET /wp-admin/", [], ["/api/v1", "/auth"])).toBe(true);
    });

    it("should still skip PHP probes even with known prefixes", () => {
      expect(shouldSkipException("Cannot GET /phpinfo.php", [], ["/api/v1"])).toBe(true);
    });

    it("should still skip web shell probes even with known prefixes", () => {
      expect(shouldSkipException("Cannot POST /alfacgiapi/bash.alfa", [], ["/api/v1"])).toBe(true);
    });

    it("should still skip RCE probes on non-known routes", () => {
      expect(shouldSkipException("Cannot POST /execute", [], ["/api/v1"])).toBe(true);
    });

    it("should still skip root POST probes", () => {
      expect(shouldSkipException("Cannot POST /", [], ["/api/v1"])).toBe(true);
    });

    // === Non "Cannot METHOD" messages must NOT be affected ===

    it("should not affect business logic errors", () => {
      expect(shouldSkipException("USER_NOT_FOUND", [], ["/api/v1"])).toBe(true); // still skipped (userErrorSkipPattern)
    });

    it("should not affect legitimate server errors", () => {
      expect(shouldSkipException("Cannot read property 'id' of undefined", [], ["/api/v1"])).toBe(false);
    });

    it("should not affect database errors", () => {
      expect(shouldSkipException("Connection to database failed", [], ["/api/v1"])).toBe(false);
    });

    it("should not affect timeout errors", () => {
      expect(shouldSkipException("Request timeout after 30000ms", [], ["/api/v1"])).toBe(false);
    });

    // === Multiple prefixes ===

    it("should protect multiple prefixes simultaneously", () => {
      const prefixes = ["/api/v1", "/auth", "/webhooks", "/internal"];
      expect(shouldSkipException("Cannot POST /api/v1/upload", [], prefixes)).toBe(false);
      expect(shouldSkipException("Cannot POST /auth/login", [], prefixes)).toBe(false);
      expect(shouldSkipException("Cannot POST /webhooks/stripe", [], prefixes)).toBe(false);
      expect(shouldSkipException("Cannot POST /internal/health", [], prefixes)).toBe(false);
      // Non-known route still skipped
      expect(shouldSkipException("Cannot GET /wp-admin/", [], prefixes)).toBe(true);
    });

    // === Prefix matching edge cases ===

    it("should match prefix exactly at start of path", () => {
      expect(shouldSkipException("Cannot POST /api/v1/something", [], ["/api/v1"])).toBe(false);
      // /api/v1x should NOT match /api/v1 prefix - but startsWith will match it
      // This is acceptable: /api/v1x is close enough to be considered part of the project
    });

    it("should not match partial prefix in the middle of path", () => {
      // /external/api/v1 should NOT match /api/v1 prefix
      expect(shouldSkipException("Cannot GET /external/api/v1/foo", [], ["/api/v1"])).toBe(true);
    });

    it("should work with trailing slash in prefix", () => {
      expect(shouldSkipException("Cannot POST /api/v1/users", [], ["/api/v1/"])).toBe(false);
    });

    it("should work with single-segment prefix", () => {
      expect(shouldSkipException("Cannot POST /auth/login", [], ["/auth"])).toBe(false);
    });

    it("should work with deep prefix", () => {
      expect(shouldSkipException("Cannot POST /api/v2/internal/admin/users", [], ["/api/v2/internal"])).toBe(false);
    });

    // === Empty/missing prefixes ===

    it("should skip normally with empty prefix array", () => {
      expect(shouldSkipException("Cannot GET /wp-admin/", [], [])).toBe(true);
    });

    it("should skip normally with no prefix argument", () => {
      expect(shouldSkipException("Cannot GET /wp-admin/")).toBe(true);
    });
  });

  describe("new scanner skip patterns", () => {
    it("should match ALFA shell probes", () => {
      expect(shouldSkipException("Cannot POST /alfacgiapi/bash.alfa")).toBe(true);
      expect(shouldSkipException("Cannot POST /ALFA_DATA/alfacgiapi/perl.alfa")).toBe(true);
      expect(shouldSkipException("Cannot POST /jancox/alfacgiapi/py.alfa")).toBe(true);
    });

    it("should match EREN shell probes", () => {
      expect(shouldSkipException("Cannot POST /ERENUSE/Erencgiapi/bash.Eren")).toBe(true);
      expect(shouldSkipException("Cannot POST /ERENUSE/perl.Eren")).toBe(true);
    });

    it("should match RCE endpoint probes", () => {
      expect(shouldSkipException("Cannot POST /api/run")).toBe(true);
      expect(shouldSkipException("Cannot POST /api/exec")).toBe(true);
      expect(shouldSkipException("Cannot POST /execute")).toBe(true);
      expect(shouldSkipException("Cannot POST /api/execute")).toBe(true);
      expect(shouldSkipException("Cannot POST /api/system")).toBe(true);
    });

    it("should match GeoServer WFS probes", () => {
      expect(shouldSkipException("Cannot POST /geoserver/wfs")).toBe(true);
      expect(shouldSkipException("Cannot POST /wfs")).toBe(true);
    });

    it("should match Citrix EPA probe", () => {
      expect(shouldSkipException("Cannot HEAD /epa/scripts/win/nsepa_setup.exe")).toBe(true);
    });

    it("should match WordPress REST batch with URL-encoded slashes", () => {
      expect(shouldSkipException("Cannot POST /?rest_route=%2Fbatch%2Fv1")).toBe(true);
      expect(shouldSkipException("Cannot POST /?rest_route=/batch%2Fv1")).toBe(true);
      expect(shouldSkipException("Cannot POST /backup/?rest_route=/batch/v1")).toBe(true);
      expect(shouldSkipException("Cannot POST /wp/?rest_route=/batch/v1")).toBe(true);
    });
  });

  describe("allBaseSkipPatterns", () => {
    it("should combine all three categories", () => {
      expect(allBaseSkipPatterns.length).toBe(
        botSkipPatterns.length + userErrorSkipPatterns.length + attackSkipPatterns.length,
      );
    });
  });
});
