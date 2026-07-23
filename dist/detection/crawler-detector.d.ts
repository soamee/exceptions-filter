import { Request } from "express";
export interface CrawlerDetectionMetadata {
    isCrawler: boolean;
    crawlerType: string | null;
    crawlerDescription: string | null;
    crawlerCategory: string | null;
    crawlerPurpose: string | null;
    crawlerDocumentationUrl: string | null;
    isLegitimate: boolean | null;
    matchedSignals: string[];
    behavioralSignals: string[];
    requestPatternAnalysis: string[];
    userAgent: string | null;
    confidenceLevel: "high" | "medium" | "low" | "none";
    recommendation: string | null;
}
export interface RequestOriginMetadata {
    clientIp: string | null;
    forwardedFor: string[];
    forwardedProto: string | null;
    forwardedHost: string | null;
    forwardedPort: string | null;
    realIp: string | null;
    requestId: string | null;
    host: string | null;
    referer: string | null;
    origin: string | null;
}
export declare function detectCrawler(request: Request): CrawlerDetectionMetadata;
export declare function extractRequestOrigin(request: Request): RequestOriginMetadata;
//# sourceMappingURL=crawler-detector.d.ts.map