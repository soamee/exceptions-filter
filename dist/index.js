"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsModule = exports.AllExceptionsFilter = exports.PrismaErrorPersistenceAdapter = exports.crawlerSignatures = exports.extractRequestOrigin = exports.detectCrawler = exports.shouldSkipException = exports.allBaseSkipPatterns = exports.attackSkipPatterns = exports.userErrorSkipPatterns = exports.botSkipPatterns = exports.BASE_SENSITIVE_HEADERS = exports.BASE_SENSITIVE_FIELDS = exports.sanitizeBody = exports.sanitizeHeaders = void 0;
__exportStar(require("./interfaces"), exports);
var sanitization_1 = require("./sanitization");
Object.defineProperty(exports, "sanitizeHeaders", { enumerable: true, get: function () { return sanitization_1.sanitizeHeaders; } });
Object.defineProperty(exports, "sanitizeBody", { enumerable: true, get: function () { return sanitization_1.sanitizeBody; } });
Object.defineProperty(exports, "BASE_SENSITIVE_FIELDS", { enumerable: true, get: function () { return sanitization_1.BASE_SENSITIVE_FIELDS; } });
Object.defineProperty(exports, "BASE_SENSITIVE_HEADERS", { enumerable: true, get: function () { return sanitization_1.BASE_SENSITIVE_HEADERS; } });
var skip_patterns_1 = require("./skip-patterns");
Object.defineProperty(exports, "botSkipPatterns", { enumerable: true, get: function () { return skip_patterns_1.botSkipPatterns; } });
Object.defineProperty(exports, "userErrorSkipPatterns", { enumerable: true, get: function () { return skip_patterns_1.userErrorSkipPatterns; } });
Object.defineProperty(exports, "attackSkipPatterns", { enumerable: true, get: function () { return skip_patterns_1.attackSkipPatterns; } });
Object.defineProperty(exports, "allBaseSkipPatterns", { enumerable: true, get: function () { return skip_patterns_1.allBaseSkipPatterns; } });
Object.defineProperty(exports, "shouldSkipException", { enumerable: true, get: function () { return skip_patterns_1.shouldSkipException; } });
var detection_1 = require("./detection");
Object.defineProperty(exports, "detectCrawler", { enumerable: true, get: function () { return detection_1.detectCrawler; } });
Object.defineProperty(exports, "extractRequestOrigin", { enumerable: true, get: function () { return detection_1.extractRequestOrigin; } });
Object.defineProperty(exports, "crawlerSignatures", { enumerable: true, get: function () { return detection_1.crawlerSignatures; } });
var adapters_1 = require("./adapters");
Object.defineProperty(exports, "PrismaErrorPersistenceAdapter", { enumerable: true, get: function () { return adapters_1.PrismaErrorPersistenceAdapter; } });
var all_exceptions_filter_1 = require("./all-exceptions.filter");
Object.defineProperty(exports, "AllExceptionsFilter", { enumerable: true, get: function () { return all_exceptions_filter_1.AllExceptionsFilter; } });
var all_exceptions_module_1 = require("./all-exceptions.module");
Object.defineProperty(exports, "AllExceptionsModule", { enumerable: true, get: function () { return all_exceptions_module_1.AllExceptionsModule; } });
