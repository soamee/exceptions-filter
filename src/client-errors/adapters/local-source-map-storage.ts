import * as fs from "fs";
import * as path from "path";
import type { SourceMapStorage } from "../source-map-storage.interface";

export class LocalSourceMapStorage implements SourceMapStorage {
  constructor(private readonly config: { basePath: string }) {}

  async getSourceMap(
    platform: string,
    version: string,
    filename: string,
  ): Promise<string | null> {
    const filePath = this.buildPath(platform, version, `${filename}.map`);
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  async uploadSourceMap(
    platform: string,
    version: string,
    filename: string,
    content: Buffer,
  ): Promise<void> {
    const filePath = this.buildPath(platform, version, `${filename}.map`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  async listVersions(platform: string): Promise<string[]> {
    const platformDir = path.join(this.config.basePath, platform);
    try {
      return fs.readdirSync(platformDir).filter((entry) => {
        return fs.statSync(path.join(platformDir, entry)).isDirectory();
      });
    } catch {
      return [];
    }
  }

  private buildPath(platform: string, version: string, file: string): string {
    return path.join(this.config.basePath, platform, version, file);
  }
}
