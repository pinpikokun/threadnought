import { describe, it, expect } from "vitest";
import { parseSearchParams } from "./params";

const actor = { operatorId: "op-1" };

describe("parseSearchParams", () => {
  it("空なら空フィルタ", () => {
    expect(parseSearchParams({}, actor)).toEqual({});
  });

  it("q をテキストに（トリム）", () => {
    expect(parseSearchParams({ q: "  りんご  " }, actor)).toEqual({ text: "りんご" });
  });

  it("空白のみの q は無視", () => {
    expect(parseSearchParams({ q: "   " }, actor)).toEqual({});
  });

  it("単一 status を配列に", () => {
    expect(parseSearchParams({ status: "UNHANDLED" }, actor)).toEqual({ status: ["UNHANDLED"] });
  });

  it("複数 status", () => {
    expect(parseSearchParams({ status: ["UNHANDLED", "DONE"] }, actor)).toEqual({ status: ["UNHANDLED", "DONE"] });
  });

  it("不正な status 値は捨てる", () => {
    expect(parseSearchParams({ status: ["UNHANDLED", "BOGUS"] }, actor)).toEqual({ status: ["UNHANDLED"] });
  });

  it("status が全て不正なら status キー無し", () => {
    expect(parseSearchParams({ status: "BOGUS" }, actor)).toEqual({});
  });

  it("assignee=operatorId", () => {
    expect(parseSearchParams({ assignee: "op-9" }, actor)).toEqual({ assignee: "op-9" });
  });

  it("label 複数を labelIds に", () => {
    expect(parseSearchParams({ label: ["l1", "l2"] }, actor)).toEqual({ labelIds: ["l1", "l2"] });
  });

  it("account 複数を accountIds に", () => {
    expect(parseSearchParams({ account: "a1" }, actor)).toEqual({ accountIds: ["a1"] });
  });

  it("view=mine は自分の operatorId を assignee に", () => {
    expect(parseSearchParams({ view: "mine" }, actor)).toEqual({ assignee: "op-1" });
  });

  it("view=unassigned は assignee=unassigned", () => {
    expect(parseSearchParams({ view: "unassigned" }, actor)).toEqual({ assignee: "unassigned" });
  });

  it("view は明示 assignee より優先", () => {
    expect(parseSearchParams({ view: "mine", assignee: "op-9" }, actor)).toEqual({ assignee: "op-1" });
  });

  it("複合", () => {
    expect(parseSearchParams({ q: "請求", status: "IN_PROGRESS", label: "l1" }, actor)).toEqual({
      text: "請求",
      status: ["IN_PROGRESS"],
      labelIds: ["l1"],
    });
  });
});
