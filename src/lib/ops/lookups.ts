import { prisma } from "@/lib/prisma";

export type AssignableOperator = { id: string; displayName: string };
export type LabelOption = { id: string; name: string; color: string };

// チケットの窓口に割り当て可能なオペレーター一覧。
// ADMIN は全窓口対象、それ以外は当該窓口(accountId)所属のみ。無効(isActive:false)は除外。
// チケットが存在しなければ null(呼び出し側で notFound() に落とす)。
export async function loadAssignableOperators(
  ticketId: string,
): Promise<AssignableOperator[] | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { accountId: true },
  });
  if (!ticket) return null;

  return prisma.operator.findMany({
    where: {
      isActive: true,
      OR: [{ role: "ADMIN" }, { accounts: { some: { id: ticket.accountId } } }],
    },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });
}

// ラベルは窓口非依存のグローバル。全件を名前昇順で返す。color は表示用に "" へ正規化。
export async function loadAllLabels(): Promise<LabelOption[]> {
  const labels = await prisma.label.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
  return labels.map((l) => ({ id: l.id, name: l.name, color: l.color ?? "" }));
}
