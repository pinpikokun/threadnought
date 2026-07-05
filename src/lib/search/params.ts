import type { TicketStatus } from "@/generated/prisma/client";
import type { TicketFilter } from "./search";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const VALID_STATUS: TicketStatus[] = ["UNHANDLED", "IN_PROGRESS", "DONE"];

// クエリ値を配列に正規化（undefined は空配列）
function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseSearchParams(
  raw: RawSearchParams,
  actor: { operatorId: string },
): TicketFilter {
  const filter: TicketFilter = {};

  const q = (Array.isArray(raw.q) ? raw.q[0] : raw.q)?.trim();
  if (q) filter.text = q;

  const statuses = toArray(raw.status).filter((s): s is TicketStatus =>
    (VALID_STATUS as string[]).includes(s),
  );
  if (statuses.length > 0) filter.status = statuses;

  const labelIds = toArray(raw.label);
  if (labelIds.length > 0) filter.labelIds = labelIds;

  const accountIds = toArray(raw.account);
  if (accountIds.length > 0) filter.accountIds = accountIds;

  // view はクイックビュー。明示 assignee より優先。
  const view = Array.isArray(raw.view) ? raw.view[0] : raw.view;
  if (view === "mine") {
    filter.assignee = actor.operatorId;
  } else if (view === "unassigned") {
    filter.assignee = "unassigned";
  } else {
    const assignee = Array.isArray(raw.assignee) ? raw.assignee[0] : raw.assignee;
    if (assignee) filter.assignee = assignee;
  }

  return filter;
}
