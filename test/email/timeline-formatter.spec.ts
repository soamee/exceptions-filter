import {
  formatActionsAsTimeline,
  formatTimelineMjml,
  formatSessionSummaryMjml,
  formatEnvelopeToMjml,
  formatActionsAsPlainText,
} from "../../src/email/timeline-formatter";
import type { BugfinderAction, BugfinderEnvelope } from "../../src/email/bugfinder-types";

const sampleActions: BugfinderAction[] = [
  {
    action: "Click: Save ticket",
    category: "click",
    timestamp: "2026-08-12T10:00:10.000Z",
    method: "POST",
    path: "/tickets/1/edit",
    elapsed: 2000,
    target: "button#save",
  },
  {
    action: "Focus: title",
    category: "input",
    timestamp: "2026-08-12T10:00:08.000Z",
    path: "/tickets/1/edit",
    elapsed: 3000,
  },
  {
    action: "Navigate to /tickets/1/edit",
    category: "navigation",
    timestamp: "2026-08-12T10:00:05.000Z",
    path: "/tickets/1/edit",
  },
  {
    action: "APP_INIT",
    category: "custom",
    timestamp: "2026-08-12T10:00:00.000Z",
    path: "/",
  },
];

const sampleEnvelope: BugfinderEnvelope = {
  path: {
    currentPath: "/tickets/1/edit",
    previousPath: "/tickets",
  },
  actions: sampleActions,
  session: {
    startedAt: "2026-08-12T10:00:00.000Z",
    actionCount: 15,
    viewport: { w: 1920, h: 1080 },
  },
};

describe("formatActionsAsTimeline()", () => {
  it("should produce HTML table rows in chronological order", () => {
    const result = formatActionsAsTimeline(sampleActions);

    expect(result).toContain("<tr>");
    const rows = result.split("</tr>").filter((r) => r.includes("<tr>"));
    // First row = oldest (APP_INIT)
    expect(rows[0]).toContain("APP_INIT");
    // Last row = newest (Click: Save ticket)
    expect(rows[rows.length - 1]).toContain("Click: Save ticket");
  });

  it("should include method in brackets", () => {
    const result = formatActionsAsTimeline(sampleActions);
    expect(result).toContain("[POST]");
  });

  it("should include elapsed time", () => {
    const result = formatActionsAsTimeline(sampleActions);
    expect(result).toContain("+2.0s");
    expect(result).toContain("+3.0s");
  });

  it("should use category-specific colors", () => {
    const result = formatActionsAsTimeline(sampleActions);
    expect(result).toContain("#4CAF50"); // click
    expect(result).toContain("#2196F3"); // navigation
    expect(result).toContain("#9C27B0"); // input
  });

  it("should tag each row with its category", () => {
    const result = formatActionsAsTimeline(sampleActions);
    // Plain text tags instead of emoji, so no email client has to fall back
    // to an emoji font.
    expect(result).toContain("NAV");
    expect(result).toContain("CLICK");
  });

  it("should return empty for no actions", () => {
    expect(formatActionsAsTimeline([])).toBe("");
    expect(formatActionsAsTimeline(undefined as unknown as BugfinderAction[])).toBe("");
  });

  it("should handle sub-second elapsed", () => {
    const actions: BugfinderAction[] = [
      {
        action: "Fast click",
        category: "click",
        timestamp: "2026-08-12T10:00:01.000Z",
        elapsed: 150,
      },
    ];
    const result = formatActionsAsTimeline(actions);
    expect(result).toContain("+150ms");
  });
});

describe("formatTimelineMjml()", () => {
  it("should wrap in MJML tags", () => {
    const result = formatTimelineMjml(sampleActions);
    expect(result).toContain("mj-text");
    expect(result).toContain("mj-table");
    expect(result).toContain("User Action Timeline");
    expect(result).toContain(`(${sampleActions.length} actions, 10.0s span)`);
  });

  it("should return empty for empty actions", () => {
    expect(formatTimelineMjml([])).toBe("");
  });
});

describe("formatSessionSummaryMjml()", () => {
  it("should include session duration", () => {
    const result = formatSessionSummaryMjml(sampleEnvelope);
    expect(result).toContain("Session duration:");
    expect(result).toContain("Session Context");
  });

  it("should include total action count", () => {
    const result = formatSessionSummaryMjml(sampleEnvelope);
    expect(result).toContain("Total actions before error: 15");
  });

  it("should include viewport", () => {
    const result = formatSessionSummaryMjml(sampleEnvelope);
    expect(result).toContain("1920x1080");
  });

  it("should include paths", () => {
    const result = formatSessionSummaryMjml(sampleEnvelope);
    expect(result).toContain("Current path: /tickets/1/edit");
    expect(result).toContain("Previous path: /tickets");
  });

  it("should handle missing viewport", () => {
    const noViewport = {
      ...sampleEnvelope,
      session: { ...sampleEnvelope.session, viewport: undefined },
    };
    const result = formatSessionSummaryMjml(noViewport);
    expect(result).not.toContain("Viewport");
  });
});

describe("formatEnvelopeToMjml()", () => {
  it("should accept BugfinderEnvelope object", () => {
    const result = formatEnvelopeToMjml(sampleEnvelope);
    expect(result).toContain("Session Context");
    expect(result).toContain("User Action Timeline");
    expect(result).toContain("mj-divider");
  });

  it("should accept base64-encoded string", () => {
    const encoded = Buffer.from(JSON.stringify(sampleEnvelope), "utf-8").toString("base64");
    const result = formatEnvelopeToMjml(encoded);
    expect(result).toContain("Session Context");
    expect(result).toContain("User Action Timeline");
  });

  it("should return empty for invalid encoded string", () => {
    expect(formatEnvelopeToMjml("not-valid!!!")).toBe("");
  });
});

describe("formatActionsAsPlainText()", () => {
  it("should produce chronological text lines", () => {
    const result = formatActionsAsPlainText(sampleActions);
    const lines = result.split("\n");

    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("[custom]");
    expect(lines[0]).toContain("APP_INIT");
    expect(lines[3]).toContain("[click]");
    expect(lines[3]).toContain("Click: Save ticket");
    expect(lines[3]).toContain("[POST]");
    expect(lines[3]).toContain("+2.0s");
  });

  it("should return empty for empty actions", () => {
    expect(formatActionsAsPlainText([])).toBe("");
  });
});
