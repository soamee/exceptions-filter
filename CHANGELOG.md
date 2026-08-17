# Changelog

All notable changes to this package are documented in this file.

## Unreleased

### Changed

- Node.js 18 is now the minimum supported runtime.
- The package now exposes only its public root entry point through the `exports` map. Consumers importing undocumented paths inside `dist` must switch to imports from `@soamee/exceptions-filter`.
- Optional Prisma, Sentry, and CASL integrations are now explicitly declared as optional peer dependencies, so package managers can report compatible integration versions without installing them automatically.
- Package contents are validated before release to prevent source and repository-only files from entering the published tarball.
