const { execFileSync } = require("node:child_process");

const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  encoding: "utf8",
});
const result = JSON.parse(output)[0];

if (!result || !Array.isArray(result.files)) {
  throw new Error("npm pack did not return a file manifest");
}

const files = new Set(result.files.map(({ path }) => path));
const required = [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/all-exceptions.filter.js",
  "dist/all-exceptions.module.js",
  "dist/adapters/prisma-error-persistence.adapter.js",
  "dist/detection/crawler-detector.js",
  "dist/email/exception-email.template.js",
  "dist/sanitization/body-sanitizer.js",
  "dist/skip-patterns/index.js",
];
const missing = required.filter((file) => !files.has(file));
const accidental = [...files].filter(
  (file) =>
    !file.startsWith("dist/") &&
    !["package.json", "README.md", "LICENSE", "CHANGELOG.md"].includes(file),
);
const sources = [...files].filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"));

if (missing.length || accidental.length || sources.length) {
  throw new Error(
    [
      missing.length && `Missing generated files: ${missing.join(", ")}`,
      accidental.length && `Unexpected files: ${accidental.join(", ")}`,
      sources.length && `TypeScript sources included: ${sources.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

console.log(`Validated ${files.size} files in ${result.filename}`);
