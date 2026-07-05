import { describe, it, expect } from "vitest";
import { decideLabelChange } from "./labels";

describe("decideLabelChange", () => {
  it("未付与ラベルの add は LABEL_ADDED を記録して apply", () => {
    const d = decideLabelChange({ currentLabelIds: ["l1"], op: "add", labelId: "l2" });
    expect(d).toEqual({
      kind: "apply",
      patch: { op: "add", labelId: "l2" },
      audits: [{ action: "LABEL_ADDED", toValue: "l2" }],
    });
  });

  it("既付与ラベルの add は noop", () => {
    expect(decideLabelChange({ currentLabelIds: ["l1", "l2"], op: "add", labelId: "l2" }))
      .toEqual({ kind: "noop" });
  });

  it("付与済みラベルの remove は LABEL_REMOVED を記録して apply", () => {
    const d = decideLabelChange({ currentLabelIds: ["l1", "l2"], op: "remove", labelId: "l2" });
    expect(d).toEqual({
      kind: "apply",
      patch: { op: "remove", labelId: "l2" },
      audits: [{ action: "LABEL_REMOVED", fromValue: "l2" }],
    });
  });

  it("未付与ラベルの remove は noop", () => {
    expect(decideLabelChange({ currentLabelIds: ["l1"], op: "remove", labelId: "l2" }))
      .toEqual({ kind: "noop" });
  });
});
