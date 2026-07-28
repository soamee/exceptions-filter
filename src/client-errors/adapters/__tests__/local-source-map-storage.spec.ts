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
