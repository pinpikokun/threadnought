import { prisma } from "@/lib/prisma";
import type { Role, TicketStatus } from "@/generated/prisma/client";
import { toTicketListItem, type TicketListItem } from "@/lib/tickets";
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
    orderBy: { updatedAt: "desc" },
  });

  const items = rows.map(toTicketListItem);

  // テキスト検索時は provider の関連度順に並べ替える
  if (idOrder) {
    const rank = new Map(idOrder.map((id, i) => [id, i] as const));
    items.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }
  return items;
}
