import { describe, it, expect } from "vitest";
import { validateMerge, validateSplit } from "./merge-split";

describe("validateMerge", () => {
  it("別チケットどうしは ok", () => {
    expect(validateMerge({ sourceId: "a", targetId: "b" })).toEqual({ ok: true });
  });
  it("自分自身への統合は不可", () => {
    expect(validateMerge({ sourceId: "a", targetId: "a" })).toEqual({ ok: false, reason: "統合元と統合先が同一です" });
  });
});

describe("validateSplit", () => {
  it("チケットに属するメールなら ok", () => {
    expect(validateSplit({ ticketMessageIds: ["m1", "m2"], messageId: "m2" })).toEqual({ ok: true });
  });
  it("属さないメールは不可", () => {
    expect(validateSplit({ ticketMessageIds: ["m1"], messageId: "mX" })).toEqual({ ok: false, reason: "対象メールがこのチケットに属しません" });
  });
  it("唯一のメールは分割できない", () => {
    expect(validateSplit({ ticketMessageIds: ["m1"], messageId: "m1" })).toEqual({ ok: false, reason: "唯一のメールは分割できません" });
  });
});
