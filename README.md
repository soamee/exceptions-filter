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
| `enableCrawlerDetection` | `boolean` | `true` | Detect bot/crawler user-agents and suppress `onError` for them. |
| `enableRequestOriginMetadata` | `boolean` | `true` | Extract client IP, forwarded headers, referer, and origin from the request. |
| `enableSentry` | `boolean` | `false` | Capture unhandled 500s to Sentry (requires `@sentry/nestjs` peer dep). |
| `enableThrottling` | `boolean` | `true` | Deduplicate rapid identical errors from the same IP within `throttleMs`. |
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

## License

MIT — Copyright (c) 2026 Tataki
