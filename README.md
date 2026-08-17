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
| `enableCrawlerDetection` | `boolean` | `false` | When enabled, detect bot/crawler requests and suppress both `onError` and email notifications for them; persistence still runs. |
| `enableRequestOriginMetadata` | `boolean` | `true` | Extract client IP, forwarded headers, referer, and origin from the request. |
| `enableSentry` | `boolean` | `false` | Capture unhandled 500s to Sentry (requires `@sentry/nestjs` peer dep). |
| `enableThrottling` | `boolean` | `false` | When enabled, skip persistence (and therefore notifications) for repeated messages from the same IP within `throttleMs`. |
| `enableDeduplication` | `boolean` | `true` | Skip DB persistence when a matching error already exists within the dedup window. |
| `hideInternalErrors` | `boolean` | `true` | Replace unhandled 500 messages with a generic string before sending to the client. |
| `throttleMs` | `number` | `1000` | Milliseconds within which identical errors from the same IP are collapsed. |
| `deduplicationWindowHours` | `number` | `24` | Hours back to search for a duplicate error record. |
| `skipMethods` | `string[]` | `['HEAD', 'MKCOL']` | HTTP methods that return the normal structured error response early, without logging, persistence, crawler detection, notifications, or `transformResponse`. |
| `extraSkipPatterns` | `RegExp[]` | `[]` | Additional patterns appended to the base skip list. |
| `extraSensitiveFields` | `string[]` | `[]` | Additional body field names to mask, appended to the base list. |
| `extraSensitiveHeaders` | `string[]` | `[]` | Additional header names to redact, appended to the base list. |
| `knownRoutePrefixes` | `string[]` | `[]` | Prefixes owned by the application. A `Cannot METHOD /path` message whose path starts with one of them bypasses all base and extra skip patterns, so it remains eligible for persistence. Merged with auto-detected prefixes. |
| `autoDetectRoutes` | `boolean` | `true` | Lazily inspect the Nest/Express router once and add prefixes (up to the first two static path segments) for registered routes to `knownRoutePrefixes`. Set to `false` to use only the manual list. |
| `persistence` | `ErrorPersistenceAdapter` | `undefined` | Optional adapter for DB persistence. Use `PrismaErrorPersistenceAdapter` or implement your own. |
| `onError` | `(error: ErrorRecord) => Promise<void>` | `undefined` | Async callback invoked with a newly created persisted record when notification gates pass. Its errors are logged and do not prevent the response or built-in email attempt. |
| `transformMessage` | `(message: string \| string[], exception: unknown, request: Request) => string \| string[]` | `undefined` | Replace the extracted message before throttling, logging, skip matching, deduplication, persistence, and client-message construction. |
| `transformResponse` | `(response: Record<string, unknown>, exception: unknown, request: Request) => Record<string, unknown>` | `undefined` | Replace the final response object immediately before `response.status(...).json(...)`. It is not run for methods handled by `skipMethods`, which return early. |
| `logger` | `FilterLogger` | `undefined` | Custom logger. Must expose `error`, `warn`, `info`, and `debug` methods. Falls back to Nest's `Logger`. |
| `emailNotification` | `EmailNotificationConfig` | `undefined` | Built-in email delivery alongside (not instead of) `onError`. Requires `enabled: true`, a non-empty `toEmails`, and an `EmailNotificationAdapter`; each recipient receives a separately rendered notification. |

`EmailNotificationConfig` consists of `enabled: boolean`, `toEmails: string[]`,
`adapter: EmailNotificationAdapter`, and optional
`userResolver: (userId: string) => Promise<UserInfo | null>`. The adapter implements
`sendNotification({ to, subject, html, action? }): Promise<void>`. If the persisted
record has a `triggeredById`, `userResolver` can supply optional `name`, `email`, and
`role` values for the template. Resolver or delivery failures are logged and do not
change the HTTP response; one recipient failing does not prevent attempts to the
others.

### Protect known routes

Known prefixes override skip-pattern matches in `Cannot METHOD /path` messages. Use
manual prefixes when routes cannot be discovered, or disable discovery for fully
explicit behavior:

```typescript
AllExceptionsModule.forRoot({
  appName: 'my-api',
  appEnvironment: 'production',
  autoDetectRoutes: false,
  knownRoutePrefixes: ['/api/v1', '/auth'],
});
```

### Transform messages and responses

```typescript
AllExceptionsModule.forRoot({
  appName: 'my-api',
  appEnvironment: 'production',
  transformMessage: (message) =>
    message === 'File too large' ? 'Upload exceeds 10 MB' : message,
  transformResponse: (response) => ({ ...response, service: 'my-api' }),
});
```

### Configure email notifications

`EmailNotificationAdapter` is transport-agnostic; wrap the mail provider used by
your application:

```typescript
import {
  AllExceptionsModule,
  EmailNotificationAdapter,
} from '@soamee/exceptions-filter';

class AppEmailAdapter implements EmailNotificationAdapter {
  constructor(private readonly mailer: MailerService) {}

  async sendNotification({ to, subject, html, action }) {
    await this.mailer.sendMail({ to, subject, html, headers: { action } });
  }
}

AllExceptionsModule.forRoot({
  appName: 'my-api',
  appEnvironment: 'production',
  persistence: errorPersistence,
  emailNotification: {
    enabled: true,
    adapter: new AppEmailAdapter(mailer),
    toEmails: ['ops@example.com', 'developers@example.com'],
    userResolver: async (userId) => users.findNotificationUser(userId),
  },
});
```

### Persistence, deduplication, crawlers, and notifications

Both notification mechanisms—`onError` and `emailNotification`—share the same
gate. They run only after `persistence.create(...)` successfully returns a **new**
record. Consequently, configuring either notification mechanism without
`persistence` sends nothing. With deduplication enabled (the default), a record
returned by `findDuplicate(...)` is not new and produces no notification.

Notifications are also suppressed for detected crawlers (when crawler detection
is enabled), messages omitted by base or extra skip patterns, throttled requests,
methods in `skipMethods`, persistence failures, and requests whose URL starts with
`/error-exceptions-messages`, `/exceptions`, or `/errors`. Crawler errors may still
be persisted; internal exception-route errors may also be persisted; it is the
notification step that is suppressed. `onError` and email are independent once
the gate passes: an `onError` failure is logged, then email is still attempted.

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

When `enableCrawlerDetection` is `true` (it is opt-in and defaults to `false`),
the filter inspects the `User-Agent` header and request behaviour. Errors from
detected crawlers are persisted to DB as normal, but both the `onError` callback
and built-in email delivery are skipped—preventing notification noise from bot
traffic.

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
