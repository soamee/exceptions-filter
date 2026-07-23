import { detectCrawler, extractRequestOrigin } from "../../src/detection";
import type { CrawlerDetectionMetadata, RequestOriginMetadata } from "../../src/detection";

function mockRequest(overrides: Record<string, unknown> = {}): any {
  return {
    headers: {},
    ip: "127.0.0.1",
    url: "/v1/test",
    method: "GET",
    ...overrides,
  };
}

describe("detectCrawler", () => {
  it("should detect Googlebot with high confidence", () => {
    const req = mockRequest({ headers: { "user-agent": "Googlebot/2.1" } });
    const result = detectCrawler(req);
    expect(result.isCrawler).toBe(true);
    expect(result.crawlerType).toBe("googlebot");
    expect(result.crawlerCategory).toBe("search-engine");
    expect(result.confidenceLevel).toBe("high");
    expect(result.isLegitimate).toBe(true);
  });

  it("should detect GPTBot as AI training", () => {
    const req = mockRequest({ headers: { "user-agent": "GPTBot/1.0" } });
    const result = detectCrawler(req);
    expect(result.isCrawler).toBe(true);
    expect(result.crawlerType).toBe("gptbot");
    expect(result.crawlerCategory).toBe("ai-training");
  });

  it("should detect generic crawler with medium confidence", () => {
    const req = mockRequest({ headers: { "user-agent": "python-requests/2.28" } });
    const result = detectCrawler(req);
    expect(result.isCrawler).toBe(true);
    expect(result.confidenceLevel).toBe("medium");
  });

  it("should not flag normal browser request", () => {
    const req = mockRequest({
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "accept-language": "en-US,en;q=0.9",
        "accept-encoding": "gzip, deflate, br",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        authorization: "Bearer token",
        cookie: "session=abc",
      },
    });
    const result = detectCrawler(req);
    expect(result.isCrawler).toBe(false);
    expect(result.confidenceLevel).toBe("none");
  });

  it("should detect crawler by behavioral signals when no user-agent", () => {
    const req = mockRequest({ headers: {} });
    const result = detectCrawler(req);
    expect(result.isCrawler).toBe(true);
    expect(result.confidenceLevel).toBe("low");
    expect(result.behavioralSignals.length).toBeGreaterThan(0);
  });
});

describe("extractRequestOrigin", () => {
  it("should extract IP and forwarded headers", () => {
    const req = mockRequest({
      ip: "10.0.0.1",
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        "x-forwarded-proto": "https",
        host: "api.example.com",
        referer: "https://app.example.com/page",
        origin: "https://app.example.com",
      },
    });
    const result = extractRequestOrigin(req);
    expect(result.clientIp).toBe("10.0.0.1");
    expect(result.forwardedFor).toEqual(["1.2.3.4", "5.6.7.8"]);
    expect(result.forwardedProto).toBe("https");
    expect(result.host).toBe("api.example.com");
    expect(result.referer).toBe("https://app.example.com/page");
    expect(result.origin).toBe("https://app.example.com");
  });

  it("should handle missing headers gracefully", () => {
    const req = mockRequest({ ip: undefined, headers: {} });
    const result = extractRequestOrigin(req);
    expect(result.clientIp).toBeNull();
    expect(result.forwardedFor).toEqual([]);
    expect(result.host).toBeNull();
  });
});
