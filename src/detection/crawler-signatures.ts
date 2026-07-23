export interface CrawlerSignatureEntry {
  type: string;
  pattern: RegExp;
  description: string;
  category:
    | "search-engine"
    | "social-media"
    | "seo-tool"
    | "ai-training"
    | "monitoring"
    | "security-scanner"
    | "advertising"
    | "archive"
    | "feed-reader"
    | "generic";
  purpose: string;
  documentationUrl: string | null;
  isLegitimate: boolean;
}

export const crawlerSignatures: CrawlerSignatureEntry[] = [
  // Search Engine Crawlers
  {
    type: "googlebot",
    pattern: /googlebot/i,
    description:
      "Google's web crawler that indexes content for Google Search results",
    category: "search-engine",
    purpose:
      "Indexes blog posts and web pages to include them in Google Search results. Follows links found in sitemaps and other pages.",
    documentationUrl:
      "https://developers.google.com/search/docs/crawling-indexing/googlebot",
    isLegitimate: true,
  },
  {
    type: "google-other",
    pattern:
      /Google-InspectionTool|Google-Extended|Googlebot-Image|Googlebot-Video|Googlebot-News|Google-Read-Aloud|Storebot-Google|GoogleOther/i,
    description:
      "Specialized Google crawlers for images, video, news, accessibility, and product feeds",
    category: "search-engine",
    purpose:
      "Indexes specific content types (images, videos, news articles, products) for Google's specialized search features.",
    documentationUrl:
      "https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers",
    isLegitimate: true,
  },
  {
    type: "bingbot",
    pattern: /bingbot/i,
    description:
      "Microsoft Bing's web crawler that indexes content for Bing search results",
    category: "search-engine",
    purpose:
      "Indexes blog posts and web pages for Bing Search. May also feed data to Microsoft Copilot AI answers.",
    documentationUrl:
      "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0",
    isLegitimate: true,
  },
  {
    type: "yandexbot",
    pattern: /yandexbot|YandexImages|YandexAccessibilityBot/i,
    description: "Yandex search engine crawler (Russian search engine)",
    category: "search-engine",
    purpose:
      "Indexes content for Yandex Search, primarily used in Russian-speaking countries.",
    documentationUrl: "https://yandex.com/support/webmaster/robot-workings/",
    isLegitimate: true,
  },
  {
    type: "baiduspider",
    pattern: /baiduspider/i,
    description: "Baidu search engine crawler (Chinese search engine)",
    category: "search-engine",
    purpose: "Indexes content for Baidu Search, primarily used in China.",
    documentationUrl: "https://www.baidu.com/search/robots_english.html",
    isLegitimate: true,
  },
  {
    type: "duckduckbot",
    pattern: /DuckDuckBot/i,
    description: "DuckDuckGo's web crawler",
    category: "search-engine",
    purpose:
      "Indexes content for DuckDuckGo search, a privacy-focused search engine.",
    documentationUrl: "https://duckduckgo.com/duckduckbot",
    isLegitimate: true,
  },
  {
    type: "applebot",
    pattern: /applebot/i,
    description:
      "Apple's web crawler used by Siri, Spotlight, and Safari suggestions",
    category: "search-engine",
    purpose:
      "Indexes content for Apple's Siri suggestions, Spotlight search, and Safari's Smart Search field.",
    documentationUrl: "https://support.apple.com/en-us/111855",
    isLegitimate: true,
  },

  // Social Media Crawlers
  {
    type: "facebook-crawler",
    pattern: /facebookexternalhit|facebot/i,
    description:
      "Facebook/Meta's crawler that generates link previews when URLs are shared",
    category: "social-media",
    purpose:
      "Fetches Open Graph metadata (title, description, image) to generate rich link previews when blog post URLs are shared on Facebook, Instagram, or Messenger.",
    documentationUrl:
      "https://developers.facebook.com/docs/sharing/webmasters/crawler/",
    isLegitimate: true,
  },
  {
    type: "twitter-crawler",
    pattern: /twitterbot/i,
    description:
      "Twitter/X's crawler that generates Twitter Card previews when URLs are shared",
    category: "social-media",
    purpose:
      "Fetches Twitter Card metadata to generate rich link previews when blog post URLs are shared on Twitter/X.",
    documentationUrl:
      "https://developer.x.com/en/docs/twitter-for-websites/cards/overview/abouts-cards",
    isLegitimate: true,
  },
  {
    type: "linkedin-crawler",
    pattern: /linkedinbot/i,
    description:
      "LinkedIn's crawler that generates link previews when URLs are shared",
    category: "social-media",
    purpose:
      "Fetches metadata to generate rich link previews when blog post URLs are shared on LinkedIn posts or messages.",
    documentationUrl: null,
    isLegitimate: true,
  },
  {
    type: "whatsapp-crawler",
    pattern: /WhatsApp/i,
    description:
      "WhatsApp's crawler that generates link previews when URLs are shared in chats",
    category: "social-media",
    purpose:
      "Fetches Open Graph metadata to generate link previews when URLs are shared in WhatsApp conversations.",
    documentationUrl: null,
    isLegitimate: true,
  },
  {
    type: "telegram-crawler",
    pattern: /TelegramBot/i,
    description:
      "Telegram's crawler that generates link previews when URLs are shared",
    category: "social-media",
    purpose:
      "Fetches metadata to generate instant previews when URLs are shared in Telegram chats or channels.",
    documentationUrl: null,
    isLegitimate: true,
  },
  {
    type: "slack-crawler",
    pattern: /Slackbot/i,
    description: "Slack's crawler that generates link unfurling previews",
    category: "social-media",
    purpose:
      "Fetches metadata to generate rich link unfurling when URLs are posted in Slack channels.",
    documentationUrl: "https://api.slack.com/robots",
    isLegitimate: true,
  },
  {
    type: "discord-crawler",
    pattern: /Discordbot/i,
    description: "Discord's crawler that generates link embed previews",
    category: "social-media",
    purpose:
      "Fetches Open Graph metadata to generate rich embeds when URLs are shared in Discord channels.",
    documentationUrl: null,
    isLegitimate: true,
  },
  {
    type: "pinterest-crawler",
    pattern: /Pinterest|Pinterestbot/i,
    description:
      "Pinterest's crawler that indexes content for pins and rich pins",
    category: "social-media",
    purpose:
      "Fetches metadata and images for Pinterest's Rich Pins feature and content discovery.",
    documentationUrl: null,
    isLegitimate: true,
  },

  // SEO and Analytics Tools
  {
    type: "semrush-crawler",
    pattern: /semrushbot/i,
    description:
      "SEMrush's crawler used for SEO analytics and competitive analysis",
    category: "seo-tool",
    purpose:
      "Crawls pages to build SEO indexes for SEMrush tools. Website owners or competitors may be using SEMrush to analyze the site's SEO performance.",
    documentationUrl: "https://www.semrush.com/bot/",
    isLegitimate: true,
  },
  {
    type: "ahrefs-crawler",
    pattern: /ahrefsbot/i,
    description:
      "Ahrefs' crawler used for backlink analysis and SEO auditing",
    category: "seo-tool",
    purpose:
      "Crawls pages to build Ahrefs' backlink index. Used by SEO professionals for link analysis and competitive research.",
    documentationUrl: "https://ahrefs.com/robot",
    isLegitimate: true,
  },
  {
    type: "moz-crawler",
    pattern: /rogerbot|DotBot/i,
    description:
      "Moz's crawlers (Rogerbot and DotBot) used for domain authority and link analysis",
    category: "seo-tool",
    purpose:
      "Crawls pages to build Moz's Link Explorer index. Used for Domain Authority calculations and SEO analysis.",
    documentationUrl: "https://moz.com/help/moz-procedures/crawlers",
    isLegitimate: true,
  },
  {
    type: "mj12-crawler",
    pattern: /mj12bot/i,
    description:
      "Majestic's crawler used for backlink indexing and trust flow analysis",
    category: "seo-tool",
    purpose:
      "Crawls pages to build Majestic's backlink database. Used for Trust Flow and Citation Flow metrics.",
    documentationUrl: "https://majestic.com/botmj12",
    isLegitimate: true,
  },
  {
    type: "screaming-frog",
    pattern: /Screaming Frog/i,
    description: "Screaming Frog SEO Spider website crawler",
    category: "seo-tool",
    purpose:
      "Technical SEO auditing tool. Someone is likely running an SEO audit on the website to find broken links, missing metadata, etc.",
    documentationUrl: "https://www.screamingfrog.co.uk/seo-spider/",
    isLegitimate: true,
  },

  // AI Training and Research Crawlers
  {
    type: "gptbot",
    pattern: /GPTBot/i,
    description:
      "OpenAI's crawler used to gather training data for GPT models",
    category: "ai-training",
    purpose:
      "Crawls web content to potentially use for training OpenAI's language models (ChatGPT, GPT-4, etc.). Can be blocked via robots.txt.",
    documentationUrl: "https://platform.openai.com/docs/gptbot",
    isLegitimate: true,
  },
  {
    type: "chatgpt-user",
    pattern: /ChatGPT-User/i,
    description:
      "OpenAI's crawler that fetches URLs when ChatGPT users ask it to browse the web",
    category: "ai-training",
    purpose:
      "Fetches web pages in real-time when ChatGPT users provide URLs or ask ChatGPT to look up information on the web.",
    documentationUrl: "https://platform.openai.com/docs/plugins/bot",
    isLegitimate: true,
  },
  {
    type: "claudebot",
    pattern: /ClaudeBot|Claude-Web|Anthropic/i,
    description:
      "Anthropic's crawler used for Claude AI training data collection",
    category: "ai-training",
    purpose:
      "Crawls web content for potential use in training Anthropic's Claude AI models. Can be blocked via robots.txt.",
    documentationUrl: "https://docs.anthropic.com/en/docs/claude-bot",
    isLegitimate: true,
  },
  {
    type: "perplexitybot",
    pattern: /PerplexityBot/i,
    description:
      "Perplexity AI's crawler used for their AI-powered search engine",
    category: "ai-training",
    purpose:
      "Crawls web content to provide AI-powered search answers on Perplexity.ai.",
    documentationUrl: "https://docs.perplexity.ai/docs/perplexitybot",
    isLegitimate: true,
  },
  {
    type: "cohere-crawler",
    pattern: /cohere-ai/i,
    description: "Cohere's crawler for AI model training data",
    category: "ai-training",
    purpose:
      "Crawls web content for Cohere's AI model training and RAG applications.",
    documentationUrl: null,
    isLegitimate: true,
  },
  {
    type: "bytespider",
    pattern: /bytespider|Bytedance/i,
    description:
      "ByteDance's crawler (TikTok parent company) used for content indexing and AI training",
    category: "ai-training",
    purpose:
      "Crawls content for ByteDance/TikTok's search features and potentially for AI model training. Known for aggressive crawling behavior.",
    documentationUrl: null,
    isLegitimate: false,
  },
  {
    type: "ccbot",
    pattern: /CCBot/i,
    description:
      "Common Crawl's open-source web crawler that builds a free web archive",
    category: "archive",
    purpose:
      "Builds a public domain web archive used by researchers and AI companies for training data. Data is freely available.",
    documentationUrl: "https://commoncrawl.org/ccbot",
    isLegitimate: true,
  },

  // Monitoring and Uptime
  {
    type: "uptimerobot",
    pattern: /UptimeRobot/i,
    description:
      "UptimeRobot monitoring service that checks website availability",
    category: "monitoring",
    purpose:
      "Periodically checks if the website is accessible. Usually configured by the site owner for uptime monitoring.",
    documentationUrl: "https://uptimerobot.com/",
    isLegitimate: true,
  },
  {
    type: "pingdom",
    pattern: /Pingdom/i,
    description: "Pingdom website monitoring service",
    category: "monitoring",
    purpose:
      "Monitors website availability and performance. Usually configured by the site owner.",
    documentationUrl: "https://www.pingdom.com/",
    isLegitimate: true,
  },
  {
    type: "datadog-synthetics",
    pattern: /Datadog.*Synthetics|Datadog Agent/i,
    description: "Datadog synthetic monitoring service",
    category: "monitoring",
    purpose:
      "Runs synthetic tests to monitor website availability and performance metrics.",
    documentationUrl: "https://docs.datadoghq.com/synthetics/",
    isLegitimate: true,
  },

  // Feed Readers
  {
    type: "feedly",
    pattern: /Feedly/i,
    description: "Feedly RSS feed reader and content aggregator",
    category: "feed-reader",
    purpose:
      "Fetches content for RSS/Atom feed readers. Users have subscribed to the blog's feed.",
    documentationUrl: null,
    isLegitimate: true,
  },

  // Security Scanners (potentially unwanted)
  {
    type: "censys",
    pattern: /CensysInspect/i,
    description: "Censys internet-wide security scanner",
    category: "security-scanner",
    purpose:
      "Performs internet-wide scans to map and analyze all publicly accessible devices and services for security research.",
    documentationUrl: "https://censys.io/",
    isLegitimate: false,
  },
  {
    type: "shodan",
    pattern: /Shodan/i,
    description: "Shodan internet device search engine scanner",
    category: "security-scanner",
    purpose:
      "Scans internet-connected devices and services. Can be used by both security researchers and attackers for reconnaissance.",
    documentationUrl: "https://www.shodan.io/",
    isLegitimate: false,
  },
  {
    type: "zgrab",
    pattern: /zgrab/i,
    description:
      "ZGrab application layer scanner often used in security research",
    category: "security-scanner",
    purpose:
      "Performs application-layer scanning. Often used by security researchers and sometimes by malicious actors for vulnerability scanning.",
    documentationUrl: null,
    isLegitimate: false,
  },

  // Advertising
  {
    type: "adsbot-google",
    pattern: /AdsBot-Google|Mediapartners-Google/i,
    description:
      "Google's advertising crawler that checks landing page quality for Google Ads",
    category: "advertising",
    purpose:
      "Verifies landing page quality and relevance for Google Ads campaigns. If you run Google Ads, this is expected traffic.",
    documentationUrl:
      "https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers#adsbot",
    isLegitimate: true,
  },

  // Archive
  {
    type: "internet-archive",
    pattern: /archive\.org_bot|Wayback/i,
    description: "Internet Archive's Wayback Machine crawler",
    category: "archive",
    purpose:
      "Archives web pages for the Internet Archive's Wayback Machine, preserving the web's history.",
    documentationUrl: "https://archive.org/about/",
    isLegitimate: true,
  },

  // Generic (catch-all, must be last)
  {
    type: "generic-crawler",
    pattern:
      /bot|crawler|spider|scrapy|curl|wget|axios|python-requests|http-client|node-fetch|go-http-client|java\/|libwww|lwp-trivial|mechanize/i,
    description: "Unidentified automated HTTP client or crawler",
    category: "generic",
    purpose:
      "Could not identify a specific known crawler. The user-agent suggests automated traffic (bot, crawler, scripting library). This may be a custom scraper, an unregistered bot, or an internal service making API calls.",
    documentationUrl: null,
    isLegitimate: false,
  },
];
