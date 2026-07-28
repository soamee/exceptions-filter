export const SOURCE_MAP_STORAGE = Symbol("SOURCE_MAP_STORAGE");

export interface SourceMapStorage {
  getSourceMap(
    platform: string,
    version: string,
    filename: string,
  ): Promise<string | null>;

  uploadSourceMap(
    platform: string,
    version: string,
    filename: string,
    content: Buffer,
  ): Promise<void>;

  listVersions(platform: string): Promise<string[]>;
}
