"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeHeaders = sanitizeHeaders;
const sensitive_keys_1 = require("./sensitive-keys");
function sanitizeHeaders(headers, extraSensitiveHeaders = []) {
    const sensitiveSet = new Set([
        ...sensitive_keys_1.BASE_SENSITIVE_HEADERS,
        ...extraSensitiveHeaders.map((h) => h.toLowerCase()),
    ]);
    const sanitized = { ...headers };
    for (const headerName of sensitiveSet) {
        if (headerName in sanitized) {
            sanitized[headerName] = "[REDACTED]";
        }
    }
    return sanitized;
}
