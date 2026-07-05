import { describe, it, expect } from "vitest";
import { decideStatusChange } from "./status";

describe("decideStatusChange", () => {
  it("同じステータスは noop", () => {
    expect(decideStatusChange({ current: "UNHANDLED", requested: "UNHANDLED" })).toEqual({ kind: "noop" });
  });

  it("未対応→対応中は STATUS_CHANGED を記録して apply", () => {
    const d = decideStatusChange({ current: "UNHANDLED", requested: "IN_PROGRESS" });
    expect(d).toEqual({
      kind: "apply",
      patch: { status: "IN_PROGRESS" },
      audits: [{ action: "STATUS_CHANGED", fromValue: "UNHANDLED", toValue: "IN_PROGRESS" }],
    });
  });

  it("完了→対応中は STATUS_CHANGED と REOPENED の両方を記録", () => {
    const d = decideStatusChange({ current: "DONE", requested: "IN_PROGRESS" });
    expect(d).toEqual({
      kind: "apply",
      patch: { status: "IN_PROGRESS" },
      audits: [
        { action: "STATUS_CHANGED", fromValue: "DONE", toValue: "IN_PROGRESS" },
        { action: "REOPENED", fromValue: "DONE", toValue: "IN_PROGRESS" },
      ],
    });
  });
});
