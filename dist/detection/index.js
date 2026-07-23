"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlerSignatures = exports.extractRequestOrigin = exports.detectCrawler = void 0;
var crawler_detector_1 = require("./crawler-detector");
Object.defineProperty(exports, "detectCrawler", { enumerable: true, get: function () { return crawler_detector_1.detectCrawler; } });
Object.defineProperty(exports, "extractRequestOrigin", { enumerable: true, get: function () { return crawler_detector_1.extractRequestOrigin; } });
var crawler_signatures_1 = require("./crawler-signatures");
Object.defineProperty(exports, "crawlerSignatures", { enumerable: true, get: function () { return crawler_signatures_1.crawlerSignatures; } });
