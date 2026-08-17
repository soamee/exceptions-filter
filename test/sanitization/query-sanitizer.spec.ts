import { sanitizeQuery } from "../../src/sanitization";

describe("sanitizeQuery", () => {
  it("supports scalars", () => {
    expect(sanitizeQuery("value")).toBe("value");
    expect(sanitizeQuery(42)).toBe(42);
  });

  it("redacts case-insensitive sensitive fields in nested objects and arrays", () => {
    const input = {
      TOKEN: "secret",
      nested: [{ access_token: "secret-2", visible: "yes" }],
      "api-key": ["one", "two"],
    };

    expect(sanitizeQuery(input)).toEqual({
      TOKEN: "******",
      nested: [{ access_token: "******", visible: "yes" }],
      "api-key": "******",
    });
    expect(input).toEqual({
      TOKEN: "secret",
      nested: [{ access_token: "secret-2", visible: "yes" }],
      "api-key": ["one", "two"],
    });
  });

  it("supports additional sensitive fields", () => {
    expect(sanitizeQuery({ Custom: "secret" }, ["custom"])).toEqual({
      Custom: "******",
    });
  });
});

