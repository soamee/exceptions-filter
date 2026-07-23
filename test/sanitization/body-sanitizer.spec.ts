import { sanitizeBody } from "../../src/sanitization/body-sanitizer";

describe("sanitizeBody", () => {
  it("should mask sensitive fields", () => {
    const data = { username: "john", password: "secret123" };
    const result = sanitizeBody(data) as typeof data;
    expect(result.username).toBe("john");
    expect(result.password).toBe("******");
  });

  it("should be case-insensitive", () => {
    const data = { Password: "secret", ApiKey: "key123" };
    const result = sanitizeBody(data) as typeof data;
    expect(result.Password).toBe("******");
    expect(result.ApiKey).toBe("******");
  });

  it("should recursively sanitize nested objects", () => {
    const data = { user: { name: "john", password: "secret" } };
    const result = sanitizeBody(data) as typeof data;
    expect(result.user.name).toBe("john");
    expect(result.user.password).toBe("******");
  });

  it("should recursively sanitize arrays", () => {
    const data = [{ password: "a" }, { password: "b" }];
    const result = sanitizeBody(data) as typeof data;
    expect(result[0].password).toBe("******");
    expect(result[1].password).toBe("******");
  });

  it("should return primitives as-is", () => {
    expect(sanitizeBody(null)).toBeNull();
    expect(sanitizeBody("string")).toBe("string");
    expect(sanitizeBody(42)).toBe(42);
    expect(sanitizeBody(undefined)).toBeUndefined();
  });

  it("should mask extra sensitive fields", () => {
    const data = { mySecret: "value", name: "john" };
    const result = sanitizeBody(data, ["mySecret"]) as typeof data;
    expect(result.mySecret).toBe("******");
    expect(result.name).toBe("john");
  });

  it("should not mutate original data", () => {
    const data = { password: "secret" };
    sanitizeBody(data);
    expect(data.password).toBe("secret");
  });
});
