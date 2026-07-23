"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allBaseSkipPatterns = exports.attackSkipPatterns = exports.userErrorSkipPatterns = exports.botSkipPatterns = void 0;
exports.shouldSkipException = shouldSkipException;
var bot_skip_patterns_1 = require("./bot-skip-patterns");
Object.defineProperty(exports, "botSkipPatterns", { enumerable: true, get: function () { return bot_skip_patterns_1.botSkipPatterns; } });
var user_error_skip_patterns_1 = require("./user-error-skip-patterns");
Object.defineProperty(exports, "userErrorSkipPatterns", { enumerable: true, get: function () { return user_error_skip_patterns_1.userErrorSkipPatterns; } });
var attack_skip_patterns_1 = require("./attack-skip-patterns");
Object.defineProperty(exports, "attackSkipPatterns", { enumerable: true, get: function () { return attack_skip_patterns_1.attackSkipPatterns; } });
const bot_skip_patterns_2 = require("./bot-skip-patterns");
const user_error_skip_patterns_2 = require("./user-error-skip-patterns");
const attack_skip_patterns_2 = require("./attack-skip-patterns");
exports.allBaseSkipPatterns = [
    ...bot_skip_patterns_2.botSkipPatterns,
    ...user_error_skip_patterns_2.userErrorSkipPatterns,
    ...attack_skip_patterns_2.attackSkipPatterns,
];
function shouldSkipException(message, extraPatterns = []) {
    const patterns = [...exports.allBaseSkipPatterns, ...extraPatterns];
    return patterns.some((pattern) => pattern.test(message));
}
