import { describe, it, expect } from "vitest";
import { decideAssigneeChange } from "./assignee";
import type { Actor } from "./types";

const admin: Actor = { operatorId: "op-admin", role: "ADMIN" };
const dispatcher: Actor = { operatorId: "op-disp", role: "DISPATCHER" };
const member: Actor = { operatorId: "op-mem", role: "MEMBER" };

describe("decideAssigneeChange", () => {
  it("同じ担当者は noop", () => {
    expect(decideAssigneeChange({ actor: admin, currentAssigneeId: "op-x", targetOperatorId: "op-x" }))
      .toEqual({ kind: "noop" });
  });

  it("ADMIN は他人へ割り当て可（ASSIGNEE_CHANGED を記録）", () => {
    const d = decideAssigneeChange({ actor: admin, currentAssigneeId: null, targetOperatorId: "op-y" });
    expect(d).toEqual({
      kind: "apply",
      patch: { assigneeId: "op-y" },
      audits: [{ action: "ASSIGNEE_CHANGED", toValue: "op-y" }],
    });
  });

  it("DISPATCHER も他人へ割り当て可（fromValue に旧担当）", () => {
    const d = decideAssigneeChange({ actor: dispatcher, currentAssigneeId: "op-a", targetOperatorId: "op-b" });
    expect(d).toEqual({
      kind: "apply",
      patch: { assigneeId: "op-b" },
      audits: [{ action: "ASSIGNEE_CHANGED", fromValue: "op-a", toValue: "op-b" }],
    });
  });

  it("MEMBER は自分へは割り当て可", () => {
    const d = decideAssigneeChange({ actor: member, currentAssigneeId: null, targetOperatorId: "op-mem" });
    expect(d).toEqual({
      kind: "apply",
      patch: { assigneeId: "op-mem" },
      audits: [{ action: "ASSIGNEE_CHANGED", toValue: "op-mem" }],
    });
  });

  it("MEMBER が他人へ割り当てようとすると forbidden", () => {
    expect(decideAssigneeChange({ actor: member, currentAssigneeId: null, targetOperatorId: "op-other" }))
      .toEqual({ kind: "forbidden" });
  });

  it("MEMBER による担当解除(null)は forbidden", () => {
    expect(decideAssigneeChange({ actor: member, currentAssigneeId: "op-mem", targetOperatorId: null }))
      .toEqual({ kind: "forbidden" });
  });

  it("ADMIN による担当解除(null)は apply（fromValue に旧担当・toValue なし）", () => {
    const d = decideAssigneeChange({ actor: admin, currentAssigneeId: "op-a", targetOperatorId: null });
    expect(d).toEqual({
      kind: "apply",
      patch: { assigneeId: null },
      audits: [{ action: "ASSIGNEE_CHANGED", fromValue: "op-a" }],
    });
  });
});
