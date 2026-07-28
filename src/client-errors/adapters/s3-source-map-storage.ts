import type { SourceMapStorage } from "../source-map-storage.interface";

interface S3StorageConfig {
  bucket: string;
  region: string;
  prefix?: string;
}

export class S3SourceMapStorage implements SourceMapStorage {
  private readonly client: any;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(config: S3StorageConfig) {
    const { S3Client } = require("@aws-sdk/client-s3");
    this.client = new S3Client({ region: config.region });
    this.bucket = config.bucket;
    this.prefix = config.prefix ?? "";
  }

  async getSourceMap(
    platform: string,
    version: string,
    filename: string,
  ): Promise<string | null> {
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    const key = this.buildKey(platform, version, `${filename}.map`);
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return response.Body.transformToString("utf-8");
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
    const { PutObjectCommand } = require("@aws-sdk/client-s3");
    const key = this.buildKey(platform, version, `${filename}.map`);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: "application/json",
      }),
    );
  }

  async listVersions(platform: string): Promise<string[]> {
    const { ListObjectsV2Command } = require("@aws-sdk/client-s3");
    const prefix = this.prefix
      ? `${this.prefix}/${platform}/`
      : `${platform}/`;
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        Delimiter: "/",
      }),
    );
    return (response.CommonPrefixes ?? [])
      .map((cp: { Prefix?: string }) => cp.Prefix?.replace(prefix, "").replace("/", ""))
      .filter(Boolean);
  }

  private buildKey(platform: string, version: string, file: string): string {
    const parts = [platform, version, file];
    if (this.prefix) parts.unshift(this.prefix);
    return parts.join("/");
  }
}
