interface ReporterConfig {
  apiUrl: string;
  appVersion: string;
  platform: "web" | "ios" | "android";
  userId?: string;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  dedupWindowMs?: number;
}

interface ErrorEntry {
  message: string;
  stack?: string;
  screen?: string;
  userAgent?: string;
  userId?: string;
  lastActions?: string[];
  metadata?: Record<string, unknown>;
}

interface ClientErrorPayload extends ErrorEntry {
  platform: string;
  appVersion: string;
}

const MAX_RETRIES = 3;

export class ErrorReporter {
  private queue: ClientErrorPayload[] = [];
  private recentKeys = new Map<string, number>();
  private currentScreen?: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly config: Required<
    Pick<ReporterConfig, "flushIntervalMs" | "maxQueueSize" | "dedupWindowMs">
  > &
    ReporterConfig;

  constructor(config: ReporterConfig) {
    this.config = {
      flushIntervalMs: 5000,
      maxQueueSize: 50,
      dedupWindowMs: 60000,
      ...config,
    };
    this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
  }

  report(entry: ErrorEntry): void {
    const dedupKey = entry.message + (entry.stack ?? "");
    const now = Date.now();
    const lastSeen = this.recentKeys.get(dedupKey);
    if (lastSeen && now - lastSeen < this.config.dedupWindowMs) return;
    this.recentKeys.set(dedupKey, now);

    // Prune expired dedup entries
    for (const [key, timestamp] of this.recentKeys.entries()) {
      if (now - timestamp > this.config.dedupWindowMs) {
        this.recentKeys.delete(key);
      }
    }

    const payload: ClientErrorPayload = {
      ...entry,
      platform: this.config.platform,
      appVersion: this.config.appVersion,
      screen: entry.screen ?? this.currentScreen,
      userId: entry.userId ?? this.config.userId,
    };

    this.queue.push(payload);
    if (this.queue.length > this.config.maxQueueSize) {
      this.queue = this.queue.slice(this.queue.length - this.config.maxQueueSize);
    }
  }

  setCurrentScreen(name: string): void {
    this.currentScreen = name;
  }

  setUserId(id: string): void {
    this.config.userId = id;
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    await Promise.all(batch.map((payload) => this.sendWithRetry(payload, 0)));
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async sendWithRetry(payload: ClientErrorPayload, attempt: number): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiUrl}/client-errors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      if (!response.ok && attempt < MAX_RETRIES) {
        await this.delay(Math.pow(2, attempt) * 1000);
        return this.sendWithRetry(payload, attempt + 1);
      }
    } catch {
      if (attempt < MAX_RETRIES) {
        await this.delay(Math.pow(2, attempt) * 1000);
        return this.sendWithRetry(payload, attempt + 1);
      }
      // Silent drop after max retries
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
