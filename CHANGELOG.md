# Changelog

All notable changes to this package are documented in this file.

## Unreleased

### Added

- The user action timeline now shows the clock time of each action and the delay since the previous one, so the journey can be read as a chronology instead of a flat list.
- Actions can report the element the user interacted with (`targetId`, `targetTestId`, or an `id` inside `target`), rendered next to each step.
- The legacy `x-last-actions` string now understands optional `[category]`, `[METHOD]`, `#element-id`, and `@timestamp` tokens per action, and is also split on `→` and newlines.

### Fixed

- The compatibility CI matrix reinstalls the optional peers (`@nestjs/platform-express`, `class-validator`, `class-transformer`) that the pinned NestJS/Express install pruned, so the build step no longer fails on missing type declarations.
- Base64-encoded action lists containing accented characters are decoded instead of being rendered as the raw encoded payload.

### Changed

- Node.js 18 is now the minimum supported runtime.
- The package now exposes only its public root entry point through the `exports` map. Consumers importing undocumented paths inside `dist` must switch to imports from `@soamee/exceptions-filter`.
- Optional Prisma, Sentry, and CASL integrations are now explicitly declared as optional peer dependencies, so package managers can report compatible integration versions without installing them automatically.
- Package contents are validated before release to prevent source and repository-only files from entering the published tarball.
