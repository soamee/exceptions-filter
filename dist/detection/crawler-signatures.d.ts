export interface CrawlerSignatureEntry {
    type: string;
    pattern: RegExp;
    description: string;
    category: "search-engine" | "social-media" | "seo-tool" | "ai-training" | "monitoring" | "security-scanner" | "advertising" | "archive" | "feed-reader" | "generic";
    purpose: string;
    documentationUrl: string | null;
    isLegitimate: boolean;
}
export declare const crawlerSignatures: CrawlerSignatureEntry[];
//# sourceMappingURL=crawler-signatures.d.ts.map