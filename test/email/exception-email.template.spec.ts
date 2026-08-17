import { renderExceptionEmail } from "../../src/email/exception-email.template";
import type { BugfinderEnvelope } from "../../src/email/bugfinder-types";

const baseError = {
  id: "error-1",
  exceptionMessage: "Something failed",
  createdAt: new Date("2026-08-12T10:00:10.000Z"),
  updatedAt: new Date("2026-08-12T10:00:10.000Z"),
};

describe("renderExceptionEmail() user actions", () => {
  it("renders a structured bugfinder envelope as a chronological timeline", () => {
    const envelope: BugfinderEnvelope = {
      path: { currentPath: "/checkout", previousPath: "/cart" },
      actions: [
        { action: "Submit order", category: "form", timestamp: "2026-08-12T10:00:10.000Z", method: "POST", elapsed: 1500 },
        { action: "Open checkout", category: "navigation", timestamp: "2026-08-12T10:00:05.000Z" },
      ],
      session: { startedAt: "2026-08-12T10:00:00.000Z", actionCount: 2 },
    };
    const lastUserActions = Buffer.from(JSON.stringify(envelope)).toString("base64");

    const { html } = renderExceptionEmail({
      error: { ...baseError, lastUserActions },
      appName: "api",
      appEnvironment: "test",
      createdAt: "2026-08-12T10:00:10.000Z",
    });

    expect(html).toContain("User Action Timeline");
    expect(html).toContain("Current screen: <strong>/checkout</strong>");
    expect(html).toContain("[POST]");
    expect(html).toContain("+1.5s");
    expect(html.indexOf("Open checkout")).toBeLessThan(html.indexOf("Submit order"));
    expect(html).not.toContain(lastUserActions);
  });

  it("keeps rendering legacy base64 comma-separated actions", () => {
    const encoded = Buffer.from("Open cart,Click checkout").toString("base64");
    const { html } = renderExceptionEmail({
      error: { ...baseError, lastUserActions: encoded },
      appName: "api",
      appEnvironment: "test",
      createdAt: "2026-08-12T10:00:10.000Z",
    });

    expect(html).toContain("Open cart");
    expect(html).toContain("Click checkout");
    expect(html).not.toContain(encoded);
  });

  it("escapes action content from structured envelopes", () => {
    const envelope: BugfinderEnvelope = {
      path: { currentPath: "/", previousPath: "" },
      actions: [{ action: "<script>alert(1)</script>", category: "custom", timestamp: "invalid" }],
      session: { startedAt: "2026-08-12T10:00:00.000Z", actionCount: 1 },
    };
    const { html } = renderExceptionEmail({
      error: { ...baseError, lastUserActions: Buffer.from(JSON.stringify(envelope)).toString("base64") },
      appName: "api",
      appEnvironment: "test",
      createdAt: "2026-08-12T10:00:10.000Z",
    });

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
