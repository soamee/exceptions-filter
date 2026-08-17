import { S3SourceMapStorage } from "../s3-source-map-storage";

const mockSend = jest.fn();
jest.mock(
  "@aws-sdk/client-s3",
  () => ({
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    GetObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: "GetObject" })),
    PutObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: "PutObject" })),
    ListObjectsV2Command: jest.fn().mockImplementation((params) => ({ ...params, _type: "ListObjects" })),
  }),
  { virtual: true },
);

describe("S3SourceMapStorage", () => {
  let storage: S3SourceMapStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new S3SourceMapStorage({ bucket: "test-bucket", region: "eu-west-1" });
  });

  it("should return null when S3 object does not exist", async () => {
    mockSend.mockRejectedValueOnce({ name: "NoSuchKey" });
    const result = await storage.getSourceMap("web", "1.0.0", "main.js");
    expect(result).toBeNull();
  });

  it("should return source map content from S3", async () => {
    const body = { transformToString: jest.fn().mockResolvedValue('{"version":3}') };
    mockSend.mockResolvedValueOnce({ Body: body });
    const result = await storage.getSourceMap("web", "1.0.0", "main.js");
    expect(result).toBe('{"version":3}');
  });

  it("should upload source map to S3", async () => {
    mockSend.mockResolvedValueOnce({});
    await storage.uploadSourceMap("web", "1.0.0", "main.js", Buffer.from("content"));
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should list versions from S3 common prefixes", async () => {
    mockSend.mockResolvedValueOnce({
      CommonPrefixes: [{ Prefix: "web/1.0.0/" }, { Prefix: "web/2.0.0/" }],
    });
    const versions = await storage.listVersions("web");
    expect(versions).toEqual(["1.0.0", "2.0.0"]);
  });
});
