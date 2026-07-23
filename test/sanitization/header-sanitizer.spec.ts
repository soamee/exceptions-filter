import { sanitizeHeaders } from "../../src/sanitization/header-sanitizer";

describe("sanitizeHeaders", () => {
  it("should redact authorization header", () => {
    const headers = { authorization: "Bearer abc123", "content-type": "application/json" };
    const result = sanitizeHeaders(headers);
    expect(result.authorization).toBe("[REDACTED]");
    expect(result["content-type"]).toBe("application/json");
  });

  it("should redact cookie header", () => {
    const headers = { cookie: "session=abc", host: "localhost" };
    const result = sanitizeHeaders(headers);
    expect(result.cookie).toBe("[REDACTED]");
    expect(result.host).toBe("localhost");
  });

  it("should redact all base sensitive headers", () => {
    const headers = {
      authorization: "Bearer x",
      cookie: "s=1",
      "set-cookie": ["s=2"] as string[],
      "proxy-authorization": "Basic x",
      "x-api-key": "key123",
      accept: "application/json",
    };
    const result = sanitizeHeaders(headers);
    expect(result.authorization).toBe("[REDACTED]");
    expect(result.cookie).toBe("[REDACTED]");
    expect(result["set-cookie"]).toBe("[REDACTED]");
    expect(result["proxy-authorization"]).toBe("[REDACTED]");
    expect(result["x-api-key"]).toBe("[REDACTED]");
    expect(result.accept).toBe("application/json");
  });

  it("should redact extra sensitive headers", () => {
    const headers = { "x-custom-secret": "secret", host: "localhost" };
    const result = sanitizeHeaders(headers, ["x-custom-secret"]);
    expect(result["x-custom-secret"]).toBe("[REDACTED]");
    expect(result.host).toBe("localhost");
  });

  it("should not mutate original headers", () => {
    const headers = { authorization: "Bearer x" };
    sanitizeHeaders(headers);
    expect(headers.authorization).toBe("Bearer x");
  });
});
