# Client Error Reporting with Source Maps — Design Spec

**Date**: 2026-07-28
**Package**: `@soamee/exceptions-filter`
**Approach**: Monopaquete — extend existing package with client error reporting capabilities

## Overview

Add client-side error capture (web + React Native mobile) with server-side source map resolution to `@soamee/exceptions-filter`. Errors from frontend and mobile apps are sent to the backend, where minified stack traces are resolved against uploaded source maps and persisted using the existing `ErrorPersistenceAdapter`.

## Package Structure

```
@soamee/exceptions-filter/
├── src/
│   ├── ... (existing code unchanged)
│   │
│   ├── client-errors/                          # NEW — Backend module
│   │   ├── client-errors.module.ts             # NestJS dynamic module
│   │   ├── client-errors.controller.ts         # POST /client-errors, POST /client-errors/sourcemaps
│   │   ├── client-errors.service.ts            # Dedup + resolve + persist
│   │   ├── client-error.dto.ts                 # Validation DTO
│   │   ├── source-map-resolver.ts              # Reads .map files, resolves stack frames
│   │   ├── source-map-storage.interface.ts     # Storage adapter interface
│   │   └── adapters/
│   │       ├── s3-source-map-storage.ts        # AWS S3 adapter
│   │       └── local-source-map-storage.ts     # Filesystem adapter (dev)
│   │
│   └── client-sdk/                             # NEW — Client-side SDK
│       ├── reporter.ts                         # Core: queue, dedup, send
│       ├── web.ts                              # window.onerror + unhandledrejection
│       ├── react.ts                            # ErrorBoundary + useErrorReporter hook
│       ├── react-native.ts                     # ErrorUtils global handler
│       └── index.ts                            # Re-exports
│
├── cli/                                        # NEW — CI/CD tooling
│   └── upload-sourcemaps.ts                    # npx upload script
│
├── package.json                                # Updated with subpath exports + bin
└── tsconfig.build.json                         # Updated to include new paths
```

### Subpath Exports (package.json)

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client-sdk/index.js",
    "./client/web": "./dist/client-sdk/web.js",
    "./client/react": "./dist/client-sdk/react.js",
    "./client/react-native": "./dist/client-sdk/react-native.js"
  },
  "bin": {
    "upload-sourcemaps": "./dist/cli/upload-sourcemaps.js"
  }
}
```

Import patterns:
- Backend: `import { ClientErrorsModule } from '@soamee/exceptions-filter'`
- Web: `import { initErrorReporter } from '@soamee/exceptions-filter/client/web'`
- React: `import { SoameeErrorBoundary } from '@soamee/exceptions-filter/client/react'`
- React Native: `import { initErrorReporter } from '@soamee/exceptions-filter/client/react-native'`
- CI: `npx @soamee/exceptions-filter upload-sourcemaps`

## Client SDK

### Payload Contract

```typescript
interface ClientErrorPayload {
  message: string;
  stack?: string;
  platform: 'web' | 'ios' | 'android';
  appVersion: string;
  screen?: string;
  userAgent?: string;
  userId?: string;
  lastActions?: string[];
  metadata?: Record<string, unknown>;
}
```

### Web (`client/web`)

```typescript
initErrorReporter({
  apiUrl: 'https://api.example.com',
  appVersion: '1.2.3',
  userId?: string,
})
```

- Hooks `window.onerror` and `window.onunhandledrejection`
- Batches errors: sends every 5s or on page unload via `navigator.sendBeacon`
- Local dedup: skips same error within 60s
- `reportError(error: Error, context?: { screen?: string })` for manual try/catch reporting

### React (`client/react`)

```tsx
<SoameeErrorBoundary fallback={<ErrorPage />}>
  <App />
</SoameeErrorBoundary>
```

- Wraps `componentDidCatch`, sends error via reporter
- `useErrorReporter()` hook returns `{ reportError }` for manual use

### React Native (`client/react-native`)

```typescript
initErrorReporter({
  apiUrl: 'https://api.example.com',
  appVersion: '1.2.3',
})
```

- Hooks `ErrorUtils.setGlobalHandler` + unhandled Promise rejections
- `Platform.OS` auto-detected as `'ios' | 'android'`
- `setCurrentScreen(name: string)` — called from navigation listeners to track active screen
- Same batch + dedup + retry logic as web

### Shared Behavior (all platforms)

- Retry with exponential backoff (1s, 2s, 4s, max 3 retries)
- Silent drop if offline (no infinite queue)
- Zero external dependencies (uses native `fetch`)
- Max 50 queued errors (oldest dropped if exceeded)

## Backend — Client Errors Module

### Controller

**`POST /client-errors`** — receives client error payloads
- Validates with `ClientErrorDto` (class-validator)
- Rate limited per IP (reuses existing throttle config)
- No auth required (errors can come from unauthenticated users)
- Accepts optional `Authorization` header to extract `userId`

**`POST /client-errors/sourcemaps`** — receives source map uploads
- Protected with API key (`x-sourcemap-api-key` header)
- Accepts multipart: `file` + `platform` + `version`
- Saves via `SourceMapStorage` adapter

### Service Flow

```
ClientErrorPayload arrives
  → dedup check (same message + version + stack hash in last 24h)
    → if duplicate: skip, return existing errorId
    → if new:
      → resolve source map (lookup .map by platform/version/filename)
      → persist to DB via ErrorPersistenceAdapter (same as backend errors)
        - appModuleName = platform ("web" | "ios" | "android")
        - stackTrace = resolved stack (or raw if no .map found)
      → call onError callback (email/slack notification)
      → return errorId
```

### Source Map Resolver

```typescript
class SourceMapResolver {
  constructor(private storage: SourceMapStorage) {}

  async resolveStack(
    rawStack: string,
    platform: string,
    version: string,
  ): Promise<string>
}
```

- Parses each stack frame to extract filename, line, column
- Fetches `.map` file from storage at path `/{platform}/{version}/{filename}.map`
- Uses `source-map` npm library to resolve original positions
- Returns human-readable stack with real filenames and line numbers
- If `.map` not found for a version: returns raw stack unchanged (does not fail)
- Caches loaded source maps in memory (LRU, max 50 entries) to avoid re-fetching

### Source Map Storage Interface

```typescript
interface SourceMapStorage {
  getSourceMap(platform: string, version: string, filename: string): Promise<string | null>;
  uploadSourceMap(platform: string, version: string, filename: string, content: Buffer): Promise<void>;
  listVersions(platform: string): Promise<string[]>;
}
```

**Adapters**:
- `S3SourceMapStorage` — reads/writes from S3 bucket. Config: `{ bucket, region, prefix? }`
- `LocalSourceMapStorage` — reads/writes from local filesystem. Config: `{ basePath }`. For development.

### Module Registration

```typescript
// In app.module.ts
ClientErrorsModule.register({
  sourceMapStorage: new S3SourceMapStorage({
    bucket: 'my-app-sourcemaps',
    region: 'eu-west-1',
  }),
  persistence: prismaAdapter,       // Same adapter used for backend errors
  onError: async (error) => {
    await mailerService.sendExceptionEmail(error);
  },
  apiKey: process.env.SOURCEMAP_API_KEY,  // Protects upload endpoint
  throttle: { ttl: 60, limit: 30 },      // Rate limit for client-errors endpoint
})
```

## CLI — Source Map Upload

### Usage

```bash
npx @soamee/exceptions-filter upload-sourcemaps \
  --version=1.2.3 \
  --platform=web \
  --dir=./dist \
  --api-url=https://api.example.com \
  --api-key=$SOURCEMAP_API_KEY \
  --clean  # optional: delete .map files after upload
```

### What It Does

1. Scans `--dir` recursively for `*.map` files
2. POSTs each to `POST /client-errors/sourcemaps` with platform + version
3. Reports progress: `Uploaded 12/12 source maps for web@1.2.3`
4. If `--clean`: deletes `.map` files from build output (so they don't get deployed publicly)

### CI/CD Integration (GitHub Actions)

```yaml
- name: Build
  run: npm run build

- name: Upload source maps
  run: npx @soamee/exceptions-filter upload-sourcemaps \
    --version=${{ github.sha }} \
    --platform=web \
    --dir=./dist \
    --api-url=${{ secrets.API_URL }} \
    --api-key=${{ secrets.SOURCEMAP_API_KEY }} \
    --clean
```

For React Native, the version should match `appVersion` sent by the client SDK. Typically the app version from `package.json` or `app.json`.

## Persistence — Reuse Existing Infrastructure

Client errors are stored in the **same** `ErrorExceptionsMessage` table as backend errors. Distinguished by:

| Field | Backend Error | Client Error |
|-------|--------------|--------------|
| `appModuleName` | `"api"` | `"web"` / `"ios"` / `"android"` |
| `requestMethod` | `"GET"`, `"POST"`, etc. | `"CLIENT_ERROR"` |
| `clientVersion` | from header | from payload `appVersion` |
| `requestContext` | from header | from payload `screen` |
| `lastUserActions` | from header | from payload `lastActions` (joined) |
| `stackTrace` | raw server stack | resolved client stack |

The existing `ErrorPersistenceAdapter` interface (`findDuplicate`, `create`) is sufficient — no schema changes needed if the DB table already has these columns.

## Error Handling & Edge Cases

- **No source map found**: Stack persisted as-is (raw/minified). No failure.
- **Storage unavailable**: Error logged, client error still persisted with raw stack.
- **Client sends garbage**: DTO validation rejects with 400.
- **Flood of errors**: Rate limit per IP + dedup prevents DB spam.
- **Old versions**: Source maps stay in storage indefinitely. Optional `listVersions` + manual cleanup.
- **Large source maps**: Streamed from storage, not loaded entirely in memory. LRU cache evicts old entries.

## Dependencies

**Backend (new)**:
- `source-map` (npm) — Mozilla's source map resolver
- `@aws-sdk/client-s3` — only for S3 adapter (optional peer dependency)
- `multer` / `@nestjs/platform-express` — for multipart upload (already in NestJS projects)

**Client SDK**:
- Zero dependencies. Uses native `fetch` and `navigator.sendBeacon`.

**CLI**:
- `commander` or minimist for arg parsing (or zero-dep manual parsing to keep it lean)
