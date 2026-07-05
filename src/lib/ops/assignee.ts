import type { Actor, AuditEntry, Decision } from "./types";

export function decideAssigneeChange(input: {
  actor: Actor;
  currentAssigneeId: string | null;
  targetOperatorId: string | null; // null = 未割り当てに戻す
}): Decision<{ assigneeId: string | null }> {
  // MEMBER は自分にのみ割り当て可（他人割当・担当解除は不可）。
  if (input.actor.role === "MEMBER" && input.targetOperatorId !== input.actor.operatorId) {
    return { kind: "forbidden" };
  }
  if (input.targetOperatorId === input.currentAssigneeId) return { kind: "noop" };

  const entry: AuditEntry = { action: "ASSIGNEE_CHANGED" };
  if (input.currentAssigneeId != null) entry.fromValue = input.currentAssigneeId;
  if (input.targetOperatorId != null) entry.toValue = input.targetOperatorId;

  return { kind: "apply", patch: { assigneeId: input.targetOperatorId }, audits: [entry] };
}
