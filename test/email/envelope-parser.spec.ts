import { parseEnvelope } from "../../src/email/envelope-parser";
import type { BugfinderEnvelope } from "../../src/email/bugfinder-types";

describe("parseEnvelope()", () => {
  const sampleEnvelope: BugfinderEnvelope = {
    path: { currentPath: "/tickets/1", previousPath: "/tickets" },
    actions: [
      {
        action: "Click: Save",
        category: "click",
        timestamp: "2026-08-12T10:00:05.000Z",
        method: "POST",
      },
    ],
    session: {
      startedAt: "2026-08-12T10:00:00.000Z",
      actionCount: 5,
      viewport: { w: 1920, h: 1080 },
    },
  };

  function encode(obj: unknown): string {
    return Buffer.from(JSON.stringify(obj), "utf-8").toString("base64");
  }

  it("should parse valid base64-encoded envelope", () => {
    const encoded = encode(sampleEnvelope);
    const result = parseEnvelope(encoded);

    expect(result).not.toBeNull();
    expect(result!.path.currentPath).toBe("/tickets/1");
    expect(result!.actions).toHaveLength(1);
    expect(result!.actions[0].action).toBe("Click: Save");
    expect(result!.session.actionCount).toBe(5);
    expect(result!.session.viewport).toEqual({ w: 1920, h: 1080 });
  });

  it("should return null for null/undefined/empty", () => {
    expect(parseEnvelope(null)).toBeNull();
    expect(parseEnvelope(undefined)).toBeNull();
    expect(parseEnvelope("")).toBeNull();
  });

  it("should return null for invalid base64", () => {
    expect(parseEnvelope("not-valid-base64!!!")).toBeNull();
  });

  it("should return null for valid base64 but invalid JSON", () => {
    const encoded = Buffer.from("not json", "utf-8").toString("base64");
    expect(parseEnvelope(encoded)).toBeNull();
  });

  it("should handle envelope with empty actions", () => {
    const envelope: BugfinderEnvelope = {
      path: { currentPath: "/", previousPath: "" },
      actions: [],
      session: { startedAt: "2026-08-12T10:00:00.000Z", actionCount: 0 },
    };
    const result = parseEnvelope(encode(envelope));
    expect(result).not.toBeNull();
    expect(result!.actions).toHaveLength(0);
  });
});
