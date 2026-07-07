import { prisma } from "@/lib/prisma";
import type { Role, TicketStatus } from "@/generated/prisma/client";
import { toTicketListItem, LIST_ORDER, type TicketListItem } from "@/lib/tickets";
import { pgTrgmSearchProvider } from "./pg-adapter";
import type { SearchProvider } from "./provider";

export type TicketFilter = {
  text?: string;
  status?: TicketStatus[];
  assignee?: string | "unassigned";
  labelIds?: string[];
  accountIds?: string[];
};

export type SearchActor = { operatorId: string; role: Role; accountIds: string[] };

export async function searchTickets(
  actor: SearchActor,
  filter: TicketFilter,
  provider: SearchProvider = pgTrgmSearchProvider,
): Promise<TicketListItem[]> {
  // 窓口スコープ（必須）と窓口ファセットは同じ accountId フィールドを絞るため、
  // 素朴に spread すると後勝ちで上書きされ権限漏洩する。交差(AND)して1つの条件にする。
  const scopeAccountIds = actor.role === "ADMIN" ? null : actor.accountIds;
  const facetAccountIds =
    filter.accountIds && filter.accountIds.length > 0 ? filter.accountIds : null;
  const effectiveAccountIds =
    scopeAccountIds && facetAccountIds
      ? facetAccountIds.filter((id) => scopeAccountIds.includes(id))
      : (facetAccountIds ?? scopeAccountIds);

  // アクセス外の窓口を要求しても結果には出ない（漏洩しない）。
  const accountFacet =
    effectiveAccountIds !== null ? { accountId: { in: effectiveAccountIds } } : {};

  const statusFacet =
    filter.status && filter.status.length > 0
      ? { status: { in: filter.status } }
      : {};

  const assigneeFacet =
    filter.assignee === "unassigned"
      ? { assigneeId: null }
      : filter.assignee
        ? { assigneeId: filter.assignee }
        : {};

  const labelFacet =
    filter.labelIds && filter.labelIds.length > 0
      ? { labels: { some: { id: { in: filter.labelIds } } } }
      : {};

  // テキスト検索は provider へ委譲。結果IDで絞り、関連度順を保つ。
  const text = filter.text?.trim();
  let idOrder: string[] | null = null;
  let textWhere: Record<string, unknown> = {};
  if (text) {
    const ids = await provider.search(text, { role: actor.role, accountIds: actor.accountIds });
    if (ids.length === 0) return [];
    idOrder = ids;
    textWhere = { id: { in: ids } };
  }

  const rows = await prisma.ticket.findMany({
    where: {
      isTrashed: false,
      ...accountFacet,
      ...statusFacet,
      ...assigneeFacet,
      ...labelFacet,
      ...textWhere,
    },
    include: { assignee: true },
    // ピン留め優先→更新順。テキスト検索時は下で関連度順に上書きする。
    orderBy: LIST_ORDER,
  });

  const items = rows.map(toTicketListItem);

  // テキスト検索時は provider の関連度順に並べ替える
  if (idOrder) {
    const rank = new Map(idOrder.map((id, i) => [id, i] as const));
    items.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }
  return items;
}

const ALL_STATUSES: TicketStatus[] = ["UNHANDLED", "IN_PROGRESS", "DONE"];

export type FacetCounts = {
  total: number;
  status: { value: TicketStatus; count: number }[];
  assignees: { operatorId: string; name: string; count: number }[];
  labels: { id: string; name: string; count: number }[];
  accounts: { id: string; name: string; count: number }[];
  quickViews: { mine: number; unassigned: number };
};

export async function getFacetCounts(actor: SearchActor): Promise<FacetCounts> {
  const scopeWhere =
    actor.role === "ADMIN" ? {} : { accountId: { in: actor.accountIds } };

  const rows = await prisma.ticket.findMany({
    where: { isTrashed: false, ...scopeWhere },
    select: {
      id: true,
      status: true,
      assigneeId: true,
      assignee: { select: { displayName: true } },
      accountId: true,
      account: { select: { name: true } },
      labels: { select: { id: true, name: true } },
    },
  });

  const statusCount = new Map<TicketStatus, number>(ALL_STATUSES.map((s) => [s, 0]));
  const assigneeCount = new Map<string, { name: string; count: number }>();
  const labelCount = new Map<string, { name: string; count: number }>();
  const accountCount = new Map<string, { name: string; count: number }>();
  let mine = 0;
  let unassigned = 0;

  for (const r of rows) {
    statusCount.set(r.status, (statusCount.get(r.status) ?? 0) + 1);

    if (r.assigneeId === null) {
      unassigned++;
    } else {
      if (r.assigneeId === actor.operatorId) mine++;
      const cur = assigneeCount.get(r.assigneeId) ?? { name: r.assignee?.displayName ?? "?", count: 0 };
      cur.count++;
      assigneeCount.set(r.assigneeId, cur);
    }

    const acc = accountCount.get(r.accountId) ?? { name: r.account.name, count: 0 };
    acc.count++;
    accountCount.set(r.accountId, acc);

    for (const lab of r.labels) {
      const lc = labelCount.get(lab.id) ?? { name: lab.name, count: 0 };
      lc.count++;
      labelCount.set(lab.id, lc);
    }
  }

  return {
    total: rows.length,
    status: ALL_STATUSES.map((s) => ({ value: s, count: statusCount.get(s) ?? 0 })),
    assignees: [...assigneeCount.entries()].map(([operatorId, v]) => ({ operatorId, name: v.name, count: v.count })),
    labels: [...labelCount.entries()].map(([id, v]) => ({ id, name: v.name, count: v.count })),
    accounts: [...accountCount.entries()].map(([id, v]) => ({ id, name: v.name, count: v.count })),
    quickViews: { mine, unassigned },
  };
}
