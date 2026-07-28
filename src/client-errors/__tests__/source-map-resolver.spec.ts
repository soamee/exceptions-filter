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
