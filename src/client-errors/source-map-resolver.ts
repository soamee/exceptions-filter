import { SourceMapConsumer } from "source-map";
import type { SourceMapStorage } from "./source-map-storage.interface";

interface StackFrame {
  raw: string;
  filename?: string;
  line?: number;
  column?: number;
}

export class SourceMapResolver {
  private readonly cache = new Map<string, any>();
  private static readonly MAX_CACHE = 50;

  constructor(private readonly storage: SourceMapStorage) {}

  async resolveStack(
    rawStack: string,
    platform: string,
    version: string,
  ): Promise<string> {
    const lines = rawStack.split("\n");
    const resolvedLines: string[] = [];

    for (const line of lines) {
      const frame = this.parseFrame(line);
      if (!frame.filename || frame.line === undefined) {
        resolvedLines.push(line);
        continue;
      }

      try {
        const consumer = await this.getConsumer(platform, version, frame.filename);
        if (!consumer) {
          resolvedLines.push(line);
          continue;
        }

        const pos = consumer.originalPositionFor({
          line: frame.line,
          column: frame.column ?? 0,
          bias: SourceMapConsumer.LEAST_UPPER_BOUND,
        });

        if (pos.source) {
          resolvedLines.push(
            `    at ${pos.name ?? "<anonymous>"} (${pos.source}:${pos.line}:${pos.column ?? 0})`,
          );
        } else {
          resolvedLines.push(line);
        }
      } catch {
        resolvedLines.push(line);
      }
    }

    return resolvedLines.join("\n");
  }

  private parseFrame(line: string): StackFrame {
    // Match patterns like "at Foo (file.js:10:20)" or "at file.js:10:20"
    const match = line.match(
      /at\s+(?:.*?\s+)?\(?([^:()]+):(\d+):(\d+)\)?/,
    );
    if (!match) return { raw: line };
    return {
      raw: line,
      filename: match[1].trim(),
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    };
  }

  private async getConsumer(
    platform: string,
    version: string,
    filename: string,
  ): Promise<any | null> {
    const cacheKey = `${platform}/${version}/${filename}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const mapContent = await this.storage.getSourceMap(platform, version, filename);
    if (!mapContent) return null;

    const consumer = await new SourceMapConsumer(JSON.parse(mapContent));

    if (this.cache.size >= SourceMapResolver.MAX_CACHE) {
      const firstKey = this.cache.keys().next().value as string | undefined;
      if (firstKey !== undefined) {
        const old = this.cache.get(firstKey);
        if (old?.destroy) old.destroy();
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(cacheKey, consumer);
    return consumer;
  }
}
