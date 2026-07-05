import type { TicketStatus } from "@/generated/prisma/client";
import type { AuditEntry, Decision } from "./types";

export function decideStatusChange(input: {
  current: TicketStatus;
  requested: TicketStatus;
}): Decision<{ status: TicketStatus }> {
  if (input.requested === input.current) return { kind: "noop" };
  const audits: AuditEntry[] = [
    { action: "STATUS_CHANGED", fromValue: input.current, toValue: input.requested },
  ];
  // 完了からの復帰は再オープンとしても記録する。
  if (input.current === "DONE") {
    audits.push({ action: "REOPENED", fromValue: input.current, toValue: input.requested });
  }
  return { kind: "apply", patch: { status: input.requested }, audits };
}
