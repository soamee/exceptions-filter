// src/client-sdk/__tests__/reporter.spec.ts
import { ErrorReporter } from "../reporter";

// Mock fetch globally
const mockFetch = jest.fn().mockResolvedValue({ ok: true });
(globalThis as any).fetch = mockFetch;

describe("ErrorReporter", () => {
  let reporter: ErrorReporter;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    reporter = new ErrorReporter({
      apiUrl: "https://api.test.com",
      appVersion: "1.0.0",
      platform: "web",
    });
  });

  afterEach(() => {
    reporter.destroy();
    jest.useRealTimers();
  });

  it("should queue an error and flush after interval", () => {
    reporter.report({ message: "test error", stack: "Error: test" });
    expect(mockFetch).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message).toBe("test error");
    expect(body.appVersion).toBe("1.0.0");
    expect(body.platform).toBe("web");
  });

  it("should deduplicate same error within 60s", () => {
    reporter.report({ message: "dup error" });
    reporter.report({ message: "dup error" });
    jest.advanceTimersByTime(5000);
    // Only one POST call (dedup dropped the second)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should drop oldest errors when queue exceeds 50", () => {
    for (let i = 0; i < 55; i++) {
      reporter.report({ message: `error-${i}` });
    }
    jest.advanceTimersByTime(5000);
    // 50 individual POST calls (one per error)
    expect(mockFetch).toHaveBeenCalledTimes(50);
    const firstBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(firstBody.message).toBe("error-5");
  });

  it("should track current screen", () => {
    reporter.setCurrentScreen("HomeScreen");
    reporter.report({ message: "screen error" });
    jest.advanceTimersByTime(5000);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.screen).toBe("HomeScreen");
  });
});
