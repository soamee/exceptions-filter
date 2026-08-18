# @soamee/exceptions-filter

A configurable NestJS global exception filter that consolidates error handling, skip patterns, request sanitization, crawler detection, and optional DB persistence into a single reusable package. Drop it into any NestJS/Express API to get consistent error responses, automatic suppression of bot/attack noise, redaction of sensitive request data, and optional notifications — all without copying boilerplate across projects.

## Installation

```bash
npm install @soamee/exceptions-filter
```

Peer dependencies (must be present in your project):

```bash
npm install @nestjs/common @nestjs/core express reflect-metadata
```

## Supported Versions

| Component | Supported versions |
|---|---|
| Node.js | 18 and later (CI covers 18, 20, and 24) |
| NestJS (`@nestjs/common` and `@nestjs/core`) | 9, 10, and 11 |
| Express | 4 and 5 |

The minimum supported runtime is Node.js 18. CI tests the minimum combination
(Node.js 18, NestJS 9, Express 4), the current combination (Node.js 24,
NestJS 11, Express 5), and an intermediate Node.js 20/NestJS 10 combination.

Prisma persistence, Sentry reporting, and CASL error handling are optional
public integrations. Install only the peers used by your application:

```bash
npm install @prisma/client # PrismaErrorPersistenceAdapter
npm install @sentry/nestjs # enableSentry
npm install @casl/ability  # ForbiddenError handling
```

## Quick Start

Minimal setup with no DB and no notifications:

```typescript
import { AllExceptionsModule } from '@soamee/exceptions-filter';

@Module({
  imports: [
    AllExceptionsModule.forRoot({
      appName: 'my-api',
      appEnvironment: process.env.NODE_ENV,
    }),
  ],
})
export class AppModule {}
```

This registers the filter globally. All unhandled exceptions are caught, logged, sanitized, and returned as structured JSON.

## Full Configuration

Full setup with async factory, Prisma persistence, email notification, and a custom logger:

```typescript
import {
  AllExceptionsModule,
  PrismaErrorPersistenceAdapter,
} from '@soamee/exceptions-filter';

@Module({
  imports: [
    AllExceptionsModule.forRootAsync({
      imports: [DatabaseModule, MailerModule, LoggerModule],
      useFactory: (
        db: DatabaseService,
        mailer: MailerService,
        logger: MyLoggerService,
      ) => ({
        appName: 'my-api',
        appEnvironment: process.env.NODE_ENV,
        enableSentry: true,
        enableCrawlerDetection: true,
        enableDeduplication: true,
        deduplicationWindowHours: 24,
        persistence: new PrismaErrorPersistenceAdapter(db),
        onError: async (error) => {
          await mailer.sendMail({
            to: 'dev@company.com',
            template: 'exception-found',
            data: error,
          });
        },
        logger,
        extraSkipPatterns: [/^MY_PROJECT_ERROR/i],
        extraSensitiveFields: ['mySecret'],
        extraSensitiveHeaders: ['x-internal-token'],
      }),
      inject: [DatabaseService, MailerService, MyLoggerService],
    }),
  ],
})
export class AppModule {}
```

## Configuration Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `appName` | `string` | — | Required. Identifier attached to every error record. |
| `appEnvironment` | `string` | — | Required. Environment tag (e.g. `production`, `staging`). |
| `enableCrawlerDetection` | `boolean` | `true` | Detect bot/crawler user-agents and suppress `onError` for them; disabled only when explicitly set to `false`. |
| `enableRequestOriginMetadata` | `boolean` | `true` | Extract client IP, forwarded headers, referer, and origin from the request. |
| `enableSentry` | `boolean` | `false` | Capture unhandled 500s to Sentry (requires `@sentry/nestjs` peer dep). |
| `enableThrottling` | `boolean` | `true` | Deduplicate rapid identical errors from the same IP within `throttleMs`; disabled only when explicitly set to `false`. |
| `enableDeduplication` | `boolean` | `true` | Skip DB persistence when a matching error already exists within the dedup window. |
| `hideInternalErrors` | `boolean` | `true` | Replace unhandled 500 messages with a generic string before sending to the client. |
| `throttleMs` | `number` | `1000` | Milliseconds within which identical errors from the same IP are collapsed. |
| `deduplicationWindowHours` | `number` | `24` | Hours back to search for a duplicate error record. |
| `skipMethods` | `string[]` | `['HEAD', 'MKCOL']` | HTTP methods that always receive an early empty response without logging. |
| `extraSkipPatterns` | `RegExp[]` | `[]` | Additional patterns appended to the base skip list. |
| `extraSensitiveFields` | `string[]` | `[]` | Additional body field names to mask, appended to the base list. |
| `extraSensitiveHeaders` | `string[]` | `[]` | Additional header names to redact, appended to the base list. |
| `persistence` | `ErrorPersistenceAdapter` | `undefined` | Optional adapter for DB persistence. Use `PrismaErrorPersistenceAdapter` or implement your own. |
| `onError` | `(error: ErrorRecord) => Promise<void>` | `undefined` | Async callback invoked after a new error is persisted. Not called for crawlers or duplicates. |
| `logger` | `FilterLogger` | `undefined` | Custom logger. Must expose `error`, `warn`, `info`, and `debug` methods. Falls back to `console`. |

## Skip Patterns

The filter ships with three categories of base skip patterns. When an exception message matches any of them, the error is logged but not persisted to DB and `onError` is not invoked.

| Category | Size | What it covers |
|---|---|---|
| `botSkipPatterns` | ~150 patterns | WordPress probes, IoT device scanning, enterprise app probing, CGI attacks, WebDAV, static asset scanning |
| `userErrorSkipPatterns` | ~50 patterns | Auth errors, validation errors, not-found errors, and expected business logic errors |
| `attackSkipPatterns` | ~100 patterns | SQL injection, XSS, path traversal, SSRF, deserialization attacks, credential scanning, framework-specific probes |

All three are combined into `allBaseSkipPatterns` and applied automatically. Base patterns cannot be removed (they are a security baseline).

To add project-specific patterns on top:

```typescript
AllExceptionsModule.forRoot({
  appName: 'my-api',
  appEnvironment: process.env.NODE_ENV,
  extraSkipPatterns: [
    /^ResourceNotFoundException/i,
    /^MY_KNOWN_SAFE_ERROR/,
  ],
});
```

You can also import the individual pattern arrays for inspection:

```typescript
import {
  botSkipPatterns,
  userErrorSkipPatterns,
  attackSkipPatterns,
  allBaseSkipPatterns,
  shouldSkipException,
} from '@soamee/exceptions-filter';

console.log(allBaseSkipPatterns.length); // total base patterns
console.log(shouldSkipException('Cannot GET /wp-admin')); // true
```

## Crawler Detection

When `enableCrawlerDetection` is `true` (default), the filter inspects the `User-Agent` header and request behaviour. Errors from detected crawlers are persisted to DB as normal, but the `onError` callback is skipped — preventing email/notification noise from bot traffic.

Detected categories:

| Category | Examples |
|---|---|
| Search engines | Googlebot, Bingbot, Yandex, Baidu, DuckDuckGo, Applebot |
| Social media | facebookexternalhit, Twitterbot, LinkedInBot, WhatsApp, Telegram, Slack, Discordbot, Pinterest |
| SEO tools | SemrushBot, AhrefsBot, MJ12bot, MajesticSEO, Screaming Frog |
| AI training | GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, cohere-ai, Bytespider, CCBot |
| Monitoring | UptimeRobot, Pingdom, Datadog |
| Security scanners | Censys, Shodan, zgrab |
| Feed readers | Feedly |
| Advertising | AdsBot-Google |
| Archive | ia_archiver (Internet Archive) |

In addition to signature matching, behavioral signals are checked: missing browser headers, a generic `Accept: */*`, and `Connection: close`.

Confidence levels returned in `CrawlerDetectionMetadata`:

- `high` — known signature matched
- `medium` — behavioral signals suggest automation
- `low` — weak signals only

## Sanitization

Sensitive data is redacted before request details are logged or persisted.

### Headers

The following headers are always replaced with `"[REDACTED]"`:

`authorization`, `cookie`, `set-cookie`, `proxy-authorization`, `x-api-key`

Add extra headers via `extraSensitiveHeaders`:

```typescript
extraSensitiveHeaders: ['x-internal-token', 'x-session-id']
```

### Body fields

The following body field names are recursively masked with `"******"` (works on nested objects and arrays):

`password`, `newPassword`, `token`, `authorization`, `apiKey`, `secretKey`, `accessToken`, `refreshToken`, `creditCard`, `ssn`

Add extra fields via `extraSensitiveFields`:

```typescript
extraSensitiveFields: ['mySecret', 'privateKey']
```

You can also call the sanitizers directly:

```typescript
import { sanitizeHeaders, sanitizeBody } from '@soamee/exceptions-filter';

const safeHeaders = sanitizeHeaders(req.headers);
const safeBody = sanitizeBody(req.body, ['myExtraField']);
```

### Query strings and URLs

`sanitizeQuery` applies the same case-insensitive field list as
`sanitizeBody`. It accepts scalar values, arrays, and nested objects, and
returns a new value without mutating its input. In addition to the field names
above, the common query spellings `access_token` and `api-key` are included.

`sanitizeUrl` preserves the pathname, fragment, and non-sensitive query
parameters while replacing every sensitive parameter value with `"******"`.
Both absolute URLs (`https://example.com/path?...`) and relative URLs
(`/path?...`) are supported. Query names and values are decoded and safely
re-encoded with the platform `URL` API, so equivalent encoding may be
normalized (for example, a space can become `+`). Repeated parameters remain
repeated. A malformed URL is never echoed back: the function returns
`"[MALFORMED URL]"` instead. `getUrlPathname` returns only the pathname and uses
the same placeholder for malformed input.

```typescript
import {
  sanitizeQuery,
  sanitizeUrl,
  getUrlPathname,
} from '@soamee/exceptions-filter';

const safeQuery = sanitizeQuery(req.query, ['privateKey']);
const safeUrl = sanitizeUrl('/users?access_token=secret&page=2');
// /users?access_token=******&page=2
const path = getUrlPathname(safeUrl); // /users
```

The exception filter uses these sanitized values for logging, duplicate
matching, and persisted `requestUrl`, `requestQuery`, and `requestPath` data.
The response's `path` field contains only the pathname, never its query string
or fragment.

## Prisma Schema

If you use `PrismaErrorPersistenceAdapter`, add this model to your `schema.prisma`:

```prisma
model errorExceptionsMessage {
  id                 String    @id @default(cuid())
  exceptionMessage   String
  file               String?
  triggeredById      String?
  stackTrace         String?
  requestMethod      String?
  requestUrl         String?
  requestHeaders     String?
  requestQuery       String?
  requestBody        String?
  additionalMessages String?
  userRole           String?
  userAgent          String?
  clientIp           String?
  clientVersion      String?
  appModuleName      String?
  correlationId      String?
  requestPath        String?
  requestContext     String?
  lastUserActions    String?
  actionElapsedMs    Int?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}
```

Run `npx prisma migrate dev` after adding the model.

## Error Response Shape

Every unhandled exception is returned to the client as:

```typescript
interface ErrorResponse {
  statusCode: number;       // HTTP status code
  error: string;            // Error type (e.g. "Not Found", "Internal Server Error")
  path: string;             // Request path
  method: string;           // HTTP method
  timestamp: Date;          // When the error occurred
  message: string | string[]; // Error message (generic string for unhandled 500s when hideInternalErrors is true)
  errorId?: string;         // Present only when the error was persisted to DB
}
```

Example:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "path": "/api/users/999",
  "method": "GET",
  "timestamp": "2026-07-23T10:00:00.000Z",
  "message": "User not found",
  "errorId": "clx1a2b3c0000xyz"
}
```

## Client Error Reporting

`@soamee/exceptions-filter` ships a ready-to-use `ClientErrorsModule` that receives errors from your web, React, React Native, and iOS/Android clients, resolves minified stack traces against uploaded source maps, and persists them through the same `ErrorPersistenceAdapter` used by the server-side filter.

### Backend — `ClientErrorsModule.register(...)`

Install the required peer deps if not already present:

```bash
npm install @nestjs/platform-express class-validator class-transformer
```

Register the module in your NestJS app:

```typescript
import { ClientErrorsModule, LocalSourceMapStorage } from '@soamee/exceptions-filter';
import { PrismaErrorPersistenceAdapter } from '@soamee/exceptions-filter';

@Module({
  imports: [
    ClientErrorsModule.register({
      // Where source maps are stored (local or S3)
      sourceMapStorage: new LocalSourceMapStorage({ basePath: './sourcemaps' }),
      // Reuse the same persistence adapter as the server filter
      persistence: new PrismaErrorPersistenceAdapter(prisma),
      // Secret key required when uploading source maps via CLI/CI
      apiKey: process.env.SOURCEMAP_API_KEY,
      // Optional: called after each new unique client error is persisted
      onError: async (error) => {
        await mailer.sendAlert(error);
      },
    }),
  ],
})
export class AppModule {}
```

This registers two endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/client-errors` | `POST` | Receive a client error report; returns `{ errorId }` |
| `/client-errors/sourcemaps` | `POST` | Upload a source map file (requires `x-sourcemap-api-key` header) |

Use `S3SourceMapStorage` instead of `LocalSourceMapStorage` to store maps in an S3-compatible bucket:

```typescript
import { S3SourceMapStorage } from '@soamee/exceptions-filter';
import { S3Client } from '@aws-sdk/client-s3';

new S3SourceMapStorage({
  client: new S3Client({ region: 'eu-west-1' }),
  bucket: 'my-sourcemaps-bucket',
})
```

### Web — `initErrorReporter(...)`

```typescript
import { initErrorReporter } from '@soamee/exceptions-filter/client/web';

initErrorReporter({
  endpoint: 'https://api.myapp.com/client-errors',
  platform: 'web',
  appVersion: import.meta.env.VITE_APP_VERSION,
});
// Uncaught errors and unhandled promise rejections are now captured automatically.
```

### React — `SoameeErrorBoundary`

```tsx
import { SoameeErrorBoundary } from '@soamee/exceptions-filter/client/react';

function App() {
  return (
    <SoameeErrorBoundary
      endpoint="https://api.myapp.com/client-errors"
      platform="web"
      appVersion={process.env.REACT_APP_VERSION}
      fallback={<p>Something went wrong.</p>}
    >
      <Router />
    </SoameeErrorBoundary>
  );
}
```

### React Native — `initErrorReporter` + `setCurrentScreen`

```typescript
import { initErrorReporter, setCurrentScreen } from '@soamee/exceptions-filter/client/react-native';

// In your app entry point
initErrorReporter({
  endpoint: 'https://api.myapp.com/client-errors',
  platform: 'ios',          // or 'android'
  appVersion: '2.1.0',
});

// In each screen component
setCurrentScreen('/home');
```

### CLI — `npx upload-sourcemaps`

After building your app, upload the generated `.map` files to the backend:

```bash
npx upload-sourcemaps \
  --api-url https://api.myapp.com/client-errors/sourcemaps \
  --api-key   "$SOURCEMAP_API_KEY" \
  --platform  web \
  --version   "$APP_VERSION" \
  --dir       ./dist
```

Options:

| Flag | Description |
|---|---|
| `--api-url` | Full URL to the `/client-errors/sourcemaps` route |
| `--api-key` | Secret matching `ClientErrorsModule.register({ apiKey })` |
| `--platform` | `web`, `ios`, or `android` |
| `--version` | App version string (e.g. `1.4.2`) |
| `--dir` | Directory to scan for `*.map` files |

### CI/CD — GitHub Actions example

```yaml
name: Upload Source Maps

on:
  push:
    branches: [main]

jobs:
  upload-maps:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci && npm run build

      - name: Upload source maps
        run: |
          npx upload-sourcemaps \
            --api-url ${{ vars.API_URL }}/client-errors/sourcemaps \
            --api-key  ${{ secrets.SOURCEMAP_API_KEY }} \
            --platform web \
            --version  ${{ github.sha }} \
            --dir      ./dist
```

## User Action Timeline

The exception email renders the user journey that led to the error. Actions come
from the request headers the bugfinder client sends:

| Header | Format |
| --- | --- |
| `x-bugfinder` | base64-encoded JSON envelope (preferred) |
| `x-last-actions` | base64-encoded flat string (legacy fallback) |

Every row shows the clock time of the action, the delay since the previous one,
the category icon, the label, and the element the user interacted with:

```
1  09:12:58            Click: Seleccionar (1)                #select-1
2  09:13:04  +6.1s     Focus: input                          #cms-title
3  09:13:12  +8.5s     Click: Seleccionar de biblioteca      [data-testid="media-library-open"]
7  09:13:41  +300ms    Navigate to /area-cliente/cms/1d45...
```

### Envelope format (`x-bugfinder`)

Actions are sent newest-first:

```json
{
  "path": { "currentPath": "/area-cliente/cms", "previousPath": "/area-cliente" },
  "session": { "startedAt": "2026-08-18T09:12:00.000Z", "actionCount": 7 },
  "actions": [
    {
      "action": "Click: Descartar",
      "category": "click",
      "timestamp": "2026-08-18T09:13:33.400Z",
      "targetId": "cms-discard",
      "targetTestId": "cms-discard-button",
      "target": "button#cms-discard",
      "method": "POST",
      "elapsed": 12400
    }
  ]
}
```

- `timestamp` drives both the clock column and the delay between actions.
- The delay is always computed from consecutive timestamps; `elapsed` is only
  used as a fallback when timestamps are missing or unparseable.
- The element shown is `targetId`, then `targetTestId`, then the `id` found in
  `target`, and finally the raw `target` selector.

### Flat format (`x-last-actions`)

Actions are separated by `,`, `→`, or newlines, in chronological order. Each
action may carry optional pipe-separated tokens:

```
Click: Seleccionar (1) | [click] | #select-1 | @2026-08-18T09:12:58.000Z
```

| Token | Meaning |
| --- | --- |
| `[click]`, `[navigation]`, … | action category |
| `[POST]`, `[GET]`, … | HTTP method |
| `#element-id` | element id |
| `@<ISO date>` or `@<epoch ms>` | timestamp |

Unknown tokens stay part of the label, so clients that only send free text keep
working — they just render as a numbered list without times.

## License

MIT — Copyright (c) 2026 Tataki
