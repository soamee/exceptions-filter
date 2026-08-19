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
    expect(html).toContain("Error on <strong style=\"color:#1a1a2e;font-family:monospace;\">/checkout</strong>");
    expect(html).toContain("[POST]");
    // Gap comes from the real distance between timestamps, not from the
    // client-reported elapsed (1500ms) which disagrees with them.
    expect(html).toContain("+5.0s");
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

  it("shows element ids and the delay between consecutive actions", () => {
    const envelope: BugfinderEnvelope = {
      path: { currentPath: "/checkout", previousPath: "" },
      actions: [
        {
          action: "Click: Pay",
          category: "click",
          timestamp: "2026-08-12T10:00:09.000Z",
          targetId: "pay-button",
        },
        {
          action: "Focus: card number",
          category: "input",
          timestamp: "2026-08-12T10:00:05.000Z",
          target: "input#card-number",
        },
      ],
      session: { startedAt: "2026-08-12T10:00:00.000Z", actionCount: 2 },
    };

    const { html } = renderExceptionEmail({
      error: { ...baseError, lastUserActions: Buffer.from(JSON.stringify(envelope)).toString("base64") },
      appName: "api",
      appEnvironment: "test",
      createdAt: "2026-08-12T10:00:10.000Z",
    });

    expect(html).toContain("#card-number");
    expect(html).toContain("#pay-button");
    expect(html).toContain("10:00:05");
    expect(html).toContain("10:00:09");
    expect(html).toContain("+4.0s");
    expect(html).toContain("(2 actions &middot; 4.0s span)");
  });

  it("renders legacy actions with category, id and timestamp tokens", () => {
    const raw = [
      "Click: Seleccionar (1) | [click] | #btn-select | @2026-08-12T10:00:00.000Z",
      "Focus: input | [input] | @2026-08-12T10:00:03.000Z",
      "Navigate to /area-cliente/cms | [navigation] | @2026-08-12T10:00:11.500Z",
    ].join(",");

    const { html } = renderExceptionEmail({
      error: { ...baseError, lastUserActions: Buffer.from(raw).toString("base64") },
      appName: "api",
      appEnvironment: "test",
      createdAt: "2026-08-12T10:00:12.000Z",
    });

    expect(html).toContain("Click: Seleccionar (1)");
    expect(html).toContain("#btn-select");
    expect(html).toContain("10:00:00");
    expect(html).toContain("+3.0s");
    expect(html).toContain("+8.5s");
    expect(html).toContain("(3 actions &middot; 11.5s span)");
    // Category tokens become icons instead of trailing "| [click]" noise.
    expect(html).not.toContain("| [click]");
  });

  it("keeps numbering legacy actions that carry no timestamps", () => {
    const raw = Buffer.from("Open cart → Click checkout").toString("base64");

    const { html } = renderExceptionEmail({
      error: { ...baseError, lastUserActions: raw },
      appName: "api",
      appEnvironment: "test",
      createdAt: "2026-08-12T10:00:10.000Z",
    });

    expect(html).toContain("Open cart");
    expect(html).toContain("Click checkout");
    expect(html).toContain("(2 actions)");
    expect(html).not.toContain("--:--:--");
  });

  it("decodes legacy actions containing accented text", () => {
    const raw = Buffer.from("Clic: Selección de biblioteca,Clic: Descartar").toString("base64");

    const { html } = renderExceptionEmail({
      error: { ...baseError, lastUserActions: raw },
      appName: "api",
      appEnvironment: "test",
      createdAt: "2026-08-12T10:00:10.000Z",
    });

    expect(html).toContain("Clic: Selección de biblioteca");
    expect(html).not.toContain(raw);
  });

  it("escapes element ids coming from the client", () => {
    const envelope: BugfinderEnvelope = {
      path: { currentPath: "/", previousPath: "" },
      actions: [
        {
          action: "Click",
          category: "click",
          timestamp: "2026-08-12T10:00:00.000Z",
          target: '<img src=x onerror="alert(1)">',
        },
      ],
      session: { startedAt: "2026-08-12T10:00:00.000Z", actionCount: 1 },
    };

    const { html } = renderExceptionEmail({
      error: { ...baseError, lastUserActions: Buffer.from(JSON.stringify(envelope)).toString("base64") },
      appName: "api",
      appEnvironment: "test",
      createdAt: "2026-08-12T10:00:10.000Z",
    });

    expect(html).not.toContain('<img src=x');
    expect(html).toContain("&lt;img src=x");
  });
});

describe("renderExceptionEmail() page context", () => {
  it("marks page changes and states where the user came from", () => {
    const envelope: BugfinderEnvelope = {
      path: { currentPath: "/checkout", previousPath: "/cart" },
      actions: [
        {
          action: "Click: Pay",
          category: "click",
          timestamp: "2026-08-12T10:00:12.000Z",
          path: "/checkout",
        },
        {
          action: "Navigate to /checkout",
          category: "navigation",
          timestamp: "2026-08-12T10:00:10.000Z",
          path: "/checkout",
        },
        {
          action: "Click: Go to checkout",
          category: "click",
          timestamp: "2026-08-12T10:00:05.000Z",
          path: "/cart",
        },
      ],
      session: { startedAt: "2026-08-12T10:00:00.000Z", actionCount: 3 },
    };

    const { html } = renderExceptionEmail({
      error: {
        ...baseError,
        lastUserActions: Buffer.from(JSON.stringify(envelope)).toString("base64"),
      },
      appName: "api",
      appEnvironment: "test",
      createdAt: "2026-08-12T10:00:12.000Z",
    });

    // Where the session started and where it ended.
    expect(html).toContain(">/cart</strong>");
    expect(html).toContain(">/checkout</strong>");
    // Full page trail.
    expect(html).toContain("/cart &rarr; /checkout");
    // The navigation row says where it came from and is highlighted.
    expect(html).toContain("from /cart");
    expect(html).toContain("#1971c2");
  });

  it("derives the page trail from legacy navigation labels", () => {
    const encoded = Buffer.from(
      [
        "WAITLIST_SIGNUP_SUBMIT | POST",
        "Click: Join the Waitlist | [click]",
        "Navigate to / | [navigation]",
        "Navigate to /en | [navigation]",
      ].join(", "),
    ).toString("base64");

    const { html } = renderExceptionEmail({
      error: { ...baseError, lastUserActions: encoded },
      appName: "api",
      appEnvironment: "test",
      createdAt: "2026-08-12T10:00:12.000Z",
    });

    // Legacy headers are newest-first, so the oldest action is rendered first
    // and the action right before the error is the last (highlighted) row.
    expect(html.indexOf("Navigate to /en")).toBeLessThan(
      html.indexOf("WAITLIST_SIGNUP_SUBMIT"),
    );
    expect(html).toContain("/en &rarr; /");
    expect(html).toContain("from /en");
    // The bare HTTP verb is rendered as a method badge, not left in the label.
    expect(html).toContain("WAITLIST_SIGNUP_SUBMIT <strong>[POST]</strong>");
  });
});
