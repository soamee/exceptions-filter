"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeBody = sanitizeBody;
const sensitive_keys_1 = require("./sensitive-keys");
function sanitizeBody(data, extraSensitiveFields = []) {
    const sensitiveFieldsLower = [
        ...sensitive_keys_1.BASE_SENSITIVE_FIELDS,
        ...extraSensitiveFields,
    ].map((f) => f.toLowerCase());
    return sanitizeRecursive(data, sensitiveFieldsLower);
}
function sanitizeRecursive(data, sensitiveFieldsLower) {
    if (typeof data !== "object" || data === null) {
        return data;
    }
    if (Array.isArray(data)) {
        return data.map((item) => sanitizeRecursive(item, sensitiveFieldsLower));
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        if (sensitiveFieldsLower.includes(key.toLowerCase())) {
            sanitized[key] = "******";
        }
        else {
            sanitized[key] = sanitizeRecursive(value, sensitiveFieldsLower);
        }
    }
    return sanitized;
}
