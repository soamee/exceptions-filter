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

  describe("allBaseSkipPatterns", () => {
    it("should combine all three categories", () => {
      expect(allBaseSkipPatterns.length).toBe(
        botSkipPatterns.length + userErrorSkipPatterns.length + attackSkipPatterns.length,
      );
    });
  });
});
