// src/cli/__tests__/upload-sourcemaps.spec.ts
import { parseArgs, findSourceMaps } from "../upload-sourcemaps";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("upload-sourcemaps CLI", () => {
  describe("parseArgs", () => {
    it("should parse all required arguments", () => {
      const args = parseArgs([
        "--version=1.0.0",
        "--platform=web",
        "--dir=./dist",
        "--api-url=https://api.test.com",
        "--api-key=secret",
      ]);
      expect(args).toEqual({
        version: "1.0.0",
        platform: "web",
        dir: "./dist",
        apiUrl: "https://api.test.com",
        apiKey: "secret",
        clean: false,
      });
    });

    it("should parse --clean flag", () => {
      const args = parseArgs([
        "--version=1.0.0",
        "--platform=web",
        "--dir=./dist",
        "--api-url=https://api.test.com",
        "--api-key=secret",
        "--clean",
      ]);
      expect(args.clean).toBe(true);
    });

    it("should throw on missing required args", () => {
      expect(() => parseArgs(["--version=1.0.0"])).toThrow();
    });
  });

  describe("findSourceMaps", () => {
    it("should find .map files recursively", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "maps-"));
      const sub = path.join(tmpDir, "sub");
      fs.mkdirSync(sub);
      fs.writeFileSync(path.join(tmpDir, "a.js.map"), "{}");
      fs.writeFileSync(path.join(sub, "b.js.map"), "{}");
      fs.writeFileSync(path.join(tmpDir, "c.js"), "code");

      const maps = findSourceMaps(tmpDir);
      expect(maps).toHaveLength(2);
      expect(maps.every((f) => f.endsWith(".map"))).toBe(true);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
