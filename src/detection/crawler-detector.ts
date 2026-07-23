import { Request } from "express";
import { crawlerSignatures } from "./crawler-signatures";

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

function getHeaderValue(header?: string | string[]): string | null {
  if (Array.isArray(header)) {
    const normalized = header[0] ? String(header[0]).trim() : null;
    return normalized && normalized.length > 0 ? normalized : null;
  }
  if (!header) return null;
  const normalized = String(header).trim();
  return normalized.length > 0 ? normalized : null;
}

export function detectCrawler(request: Request): CrawlerDetectionMetadata {
  const userAgent = getHeaderValue(request.headers["user-agent"]);
  const matchedSignals: string[] = [];
  const behavioralSignals: string[] = [];
  const requestPatternAnalysis: string[] = [];

  const detectedCrawler = userAgent
    ? crawlerSignatures.find(({ pattern }) => pattern.test(userAgent))
    : null;

  if (detectedCrawler) {
    matchedSignals.push(`user-agent-match:${detectedCrawler.type}`);
  }

  // Behavioral analysis
  const hasAuthorization = Boolean(request.headers["authorization"]);
  const hasCookies = Boolean(request.headers["cookie"]);
  const acceptLanguage = getHeaderValue(request.headers["accept-language"]);
  const acceptEncoding = getHeaderValue(request.headers["accept-encoding"]);
  const acceptHeader = getHeaderValue(request.headers["accept"]);
  const secFetchMode = getHeaderValue(request.headers["sec-fetch-mode"]);
  const secFetchSite = getHeaderValue(request.headers["sec-fetch-site"]);
  const connection = getHeaderValue(request.headers["connection"]);

  if (!hasAuthorization) behavioralSignals.push("no-authorization-header");
  if (!hasCookies) behavioralSignals.push("no-cookies");
  if (!acceptLanguage) behavioralSignals.push("no-accept-language (browsers always send this)");
  if (!acceptEncoding) behavioralSignals.push("no-accept-encoding (browsers always send this)");
  if (!secFetchMode && !secFetchSite) behavioralSignals.push("no-sec-fetch-* headers (modern browsers always send these)");
  if (acceptHeader === "*/*") behavioralSignals.push("accept:*/* (generic accept header, typical of bots/scripts)");
  if (connection && connection.toLowerCase() === "close") behavioralSignals.push("connection:close (bots often close connections immediately)");

  if (userAgent) {
    if (/^axios\//i.test(userAgent)) behavioralSignals.push("user-agent is axios HTTP client (server-side request, not a browser)");
    else if (/^node-fetch\//i.test(userAgent) || /^node\//i.test(userAgent)) behavioralSignals.push("user-agent is Node.js HTTP client (server-side request)");
    else if (/^python-requests\//i.test(userAgent) || /^python-urllib\//i.test(userAgent)) behavioralSignals.push("user-agent is Python HTTP client (likely a script or scraper)");
    else if (/^curl\//i.test(userAgent)) behavioralSignals.push("user-agent is curl (command-line HTTP client)");
    else if (/^wget\//i.test(userAgent)) behavioralSignals.push("user-agent is wget (command-line download tool)");
    else if (/^Go-http-client\//i.test(userAgent)) behavioralSignals.push("user-agent is Go HTTP client (server-side or tool request)");
    else if (/^Java\//i.test(userAgent)) behavioralSignals.push("user-agent is Java HTTP client (server-side application)");
  } else {
    behavioralSignals.push("no-user-agent (very suspicious, all browsers send user-agent)");
  }

  // Request pattern analysis
  const requestUrl = request.url || "";
  const requestMethod = request.method || "";

  if (!hasAuthorization && requestMethod === "GET") {
    requestPatternAnalysis.push("unauthenticated-get: simple GET without authentication (common crawler pattern)");
  }
  if (/^\/v\d+\//i.test(requestUrl) && !request.headers["x-requested-with"]) {
    requestPatternAnalysis.push("direct-api-access: accessing versioned API directly without x-requested-with header");
  }
  if (!getHeaderValue(request.headers["referer"])) {
    requestPatternAnalysis.push("no-referer: request has no referer header (crawlers typically don't send referer)");
  }

  // Confidence level
  const suspiciousBehavioralCount = behavioralSignals.filter(
    (s) =>
      s.includes("no-accept-language") ||
      s.includes("no-sec-fetch") ||
      s.includes("no-user-agent") ||
      s.includes("accept:*/*") ||
      s.includes("HTTP client") ||
      s.includes("curl") ||
      s.includes("wget"),
  ).length;

  let confidenceLevel: "high" | "medium" | "low" | "none";
  let isCrawler: boolean;

  if (detectedCrawler && detectedCrawler.type !== "generic-crawler") {
    confidenceLevel = "high";
    isCrawler = true;
  } else if (detectedCrawler) {
    confidenceLevel = "medium";
    isCrawler = true;
  } else if (suspiciousBehavioralCount >= 3) {
    confidenceLevel = "low";
    isCrawler = true;
    behavioralSignals.push("behavioral-heuristic: classified as likely crawler based on multiple missing browser-standard headers");
  } else {
    confidenceLevel = "none";
    isCrawler = false;
  }

  // Recommendation
  let recommendation: string | null = null;
  if (isCrawler && detectedCrawler) {
    if (detectedCrawler.category === "search-engine" || detectedCrawler.category === "social-media") {
      recommendation = `Legitimate ${detectedCrawler.category} crawler. Error likely means the URL doesn't exist or slug is malformed. Check sitemap and meta tags.`;
    } else if (detectedCrawler.category === "seo-tool") {
      recommendation = `SEO analysis tool crawling your site. Block via robots.txt if unwanted.`;
    } else if (detectedCrawler.category === "ai-training") {
      recommendation = `AI training data crawler. Block via robots.txt (User-agent: ${detectedCrawler.type}) if unwanted.`;
    } else if (detectedCrawler.category === "security-scanner") {
      recommendation = `Security scanner. Monitor for suspicious patterns, consider firewall block.`;
    } else if (!detectedCrawler.isLegitimate) {
      recommendation = `Crawler not necessarily legitimate. Consider blocking via robots.txt or firewall.`;
    }
  } else if (isCrawler) {
    recommendation = "Crawler-like behavior but unidentified by user-agent. May be custom scraper or misconfigured client.";
  }

  // Tracking signals
  const forwardedFor = getHeaderValue(request.headers["x-forwarded-for"]);
  if (forwardedFor) matchedSignals.push(`forwarded-for:${forwardedFor}`);
  matchedSignals.push(`method:${requestMethod}`);
  matchedSignals.push(`path:${requestUrl}`);

  return {
    isCrawler,
    crawlerType: detectedCrawler?.type ?? null,
    crawlerDescription: detectedCrawler?.description ?? null,
    crawlerCategory: detectedCrawler?.category ?? null,
    crawlerPurpose: detectedCrawler?.purpose ?? null,
    crawlerDocumentationUrl: detectedCrawler?.documentationUrl ?? null,
    isLegitimate: detectedCrawler?.isLegitimate ?? null,
    matchedSignals,
    behavioralSignals,
    requestPatternAnalysis,
    userAgent,
    confidenceLevel,
    recommendation,
  };
}

export function extractRequestOrigin(request: Request): RequestOriginMetadata {
  const forwardedForRaw = getHeaderValue(request.headers["x-forwarded-for"]);

  return {
    clientIp: request.ip ?? null,
    forwardedFor: forwardedForRaw
      ? forwardedForRaw.split(",").map((v) => v.trim()).filter(Boolean)
      : [],
    forwardedProto: getHeaderValue(request.headers["x-forwarded-proto"]),
    forwardedHost: getHeaderValue(request.headers["x-forwarded-host"]),
    forwardedPort: getHeaderValue(request.headers["x-forwarded-port"]),
    realIp: getHeaderValue(request.headers["x-real-ip"]),
    requestId: getHeaderValue(request.headers["x-request-id"]),
    host: getHeaderValue(request.headers.host),
    referer: getHeaderValue(request.headers.referer),
    origin: getHeaderValue(request.headers.origin),
  };
}
