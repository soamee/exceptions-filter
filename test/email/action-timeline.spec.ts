import {
  buildTimeline,
  describeTarget,
  formatGap,
  formatSpan,
  parseLegacyActions,
  resolveElementId,
  timelineSpanMs,
} from "../../src/email/action-timeline";
import type { BugfinderAction } from "../../src/email/bugfinder-types";

const newestFirst: BugfinderAction[] = [
  { action: "Submit order", category: "form", timestamp: "2026-08-12T10:00:12.500Z" },
  { action: "Click: Pay", category: "click", timestamp: "2026-08-12T10:00:10.000Z" },
  { action: "Open checkout", category: "navigation", timestamp: "2026-08-12T10:00:05.000Z" },
];

describe("buildTimeline()", () => {
  it("orders newest-first actions chronologically and numbers them", () => {
    const entries = buildTimeline(newestFirst);

    expect(entries.map((e) => e.action.action)).toEqual([
      "Open checkout",
      "Click: Pay",
      "Submit order",
    ]);
    expect(entries.map((e) => e.index)).toEqual([1, 2, 3]);
    expect(entries[2].isLast).toBe(true);
  });

  it("computes the delay between each action and the previous one", () => {
    const entries = buildTimeline(newestFirst);

    expect(entries[0].gapMs).toBeUndefined();
    expect(entries[1].gapMs).toBe(5000);
    expect(entries[1].gapLabel).toBe("+5.0s");
    expect(entries[2].gapMs).toBe(2500);
    expect(entries[2].gapLabel).toBe("+2.5s");
  });

  it("accepts already chronological actions", () => {
    const entries = buildTimeline([...newestFirst].reverse(), {
      order: "chronological",
    });

    expect(entries[0].action.action).toBe("Open checkout");
    expect(entries[1].gapMs).toBe(5000);
  });

  it("prefers real timestamps over the client-reported elapsed", () => {
    const entries = buildTimeline([
      { action: "b", category: "click", timestamp: "2026-08-12T10:00:10.000Z", elapsed: 1500 },
      { action: "a", category: "click", timestamp: "2026-08-12T10:00:05.000Z" },
    ]);

    expect(entries[1].gapMs).toBe(5000);
  });

  it("falls back to elapsed when timestamps are unusable", () => {
    const entries = buildTimeline([
      { action: "b", category: "click", timestamp: "nope", elapsed: 800 },
      { action: "a", category: "click", timestamp: "nope" },
    ]);

    expect(entries[0].time).toBe("");
    expect(entries[1].gapLabel).toBe("+800ms");
  });

  it("does not invent a gap for out-of-order timestamps", () => {
    const entries = buildTimeline([
      { action: "older", category: "click", timestamp: "2026-08-12T10:00:01.000Z" },
      { action: "newer", category: "click", timestamp: "2026-08-12T10:00:09.000Z" },
    ]);

    expect(entries[1].gapMs).toBeUndefined();
    expect(entries[1].gapLabel).toBe("");
  });

  it("returns an empty timeline for missing actions", () => {
    expect(buildTimeline(undefined)).toEqual([]);
    expect(buildTimeline([])).toEqual([]);
  });
});

describe("timelineSpanMs()", () => {
  it("measures first to last action", () => {
    expect(timelineSpanMs(buildTimeline(newestFirst))).toBe(7500);
  });

  it("is undefined with less than two timestamps", () => {
    expect(timelineSpanMs(buildTimeline([newestFirst[0]]))).toBeUndefined();
  });
});

describe("formatGap() / formatSpan()", () => {
  it("formats sub-second, seconds and minutes", () => {
    expect(formatGap(150)).toBe("+150ms");
    expect(formatGap(999)).toBe("+999ms");
    expect(formatGap(1000)).toBe("+1.0s");
    expect(formatGap(65000)).toBe("+1m 05s");
    expect(formatSpan(125000)).toBe("2m 05s");
  });

  it("returns empty for unknown or negative values", () => {
    expect(formatGap(undefined)).toBe("");
    expect(formatGap(-10)).toBe("");
    expect(formatSpan(undefined)).toBe("");
  });
});

describe("resolveElementId() / describeTarget()", () => {
  it("uses the explicit element id", () => {
    expect(resolveElementId({ action: "a", category: "click", timestamp: "", targetId: "save-btn" }))
      .toBe("#save-btn");
    expect(resolveElementId({ action: "a", category: "click", timestamp: "", targetId: "#save-btn" }))
      .toBe("#save-btn");
  });

  it("falls back to the test id and then to an id inside the selector", () => {
    expect(resolveElementId({ action: "a", category: "click", timestamp: "", targetTestId: "save" }))
      .toBe('[data-testid="save"]');
    expect(resolveElementId({ action: "a", category: "click", timestamp: "", target: "button#save" }))
      .toBe("#save");
  });

  it("describes the raw target when there is no id at all", () => {
    const action: BugfinderAction = {
      action: "a",
      category: "click",
      timestamp: "",
      target: "button.primary",
    };
    expect(resolveElementId(action)).toBeUndefined();
    expect(describeTarget(action)).toBe("button.primary");
    expect(describeTarget({ action: "a", category: "click", timestamp: "" })).toBeUndefined();
  });
});

describe("parseLegacyActions()", () => {
  it("splits on commas and arrows", () => {
    const actions = parseLegacyActions("Open cart, Click checkout → Submit");
    expect(actions.map((a) => a.action)).toEqual([
      "Open cart",
      "Click checkout",
      "Submit",
    ]);
  });

  it("reads category, element id and timestamp tokens", () => {
    const [action] = parseLegacyActions(
      "Click: Seleccionar | [click] | #btn-select | @2026-08-12T10:00:05.000Z",
    );

    expect(action.action).toBe("Click: Seleccionar");
    expect(action.category).toBe("click");
    expect(action.targetId).toBe("#btn-select");
    expect(action.timestamp).toBe("2026-08-12T10:00:05.000Z");
  });

  it("reads epoch millisecond timestamps and HTTP methods", () => {
    const [action] = parseLegacyActions("Fetch orders | [api] | [POST] | @1755000000000");

    expect(action.method).toBe("POST");
    expect(action.category).toBe("api");
    expect(action.timestamp).toBe(new Date(1755000000000).toISOString());
  });

  it("keeps unknown tokens as part of the label", () => {
    const [action] = parseLegacyActions("Click: Save | [weird] | extra info");

    expect(action.action).toBe("Click: Save | [weird] | extra info");
    expect(action.category).toBe("custom");
  });

  it("ignores empty entries", () => {
    expect(parseLegacyActions(" , ,")).toEqual([]);
  });
});
