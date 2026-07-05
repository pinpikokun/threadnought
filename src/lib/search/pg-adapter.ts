import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { SearchProvider } from "./provider";

// ILIKE のワイルドカード文字をエスケープ（ユーザ入力をリテラル一致にする）
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => "\\" + c);
}

export const pgTrgmSearchProvider: SearchProvider = {
  async search(text, scope) {
    const trimmed = text.trim();
    if (trimmed === "") return [];
    // 非ADMINでアクセス窓口ゼロは何も見えない（fail-closed）
    if (scope.role !== "ADMIN" && scope.accountIds.length === 0) return [];

    const like = `%${escapeLike(trimmed)}%`;
    const scopeCond =
      scope.role === "ADMIN"
        ? Prisma.sql`TRUE`
        : Prisma.sql`t."accountId" = ANY(${scope.accountIds})`;

    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT t.id
      FROM "Ticket" t
      LEFT JOIN "Message" m ON m."ticketId" = t.id
      LEFT JOIN "Contact" c ON c.id = t."contactId"
      WHERE t."isTrashed" = false
        AND ${scopeCond}
        AND (
          t.title ILIKE ${like} ESCAPE '\\' OR
          t.subject ILIKE ${like} ESCAPE '\\' OR
          t."caseNumber" ILIKE ${like} ESCAPE '\\' OR
          t.token ILIKE ${like} ESCAPE '\\' OR
          m.subject ILIKE ${like} ESCAPE '\\' OR
          m."bodyText" ILIKE ${like} ESCAPE '\\' OR
          m."fromAddr" ILIKE ${like} ESCAPE '\\' OR
          array_to_string(m."toAddrs", ' ') ILIKE ${like} ESCAPE '\\' OR
          c.email ILIKE ${like} ESCAPE '\\' OR
          c.name ILIKE ${like} ESCAPE '\\' OR
          c.company ILIKE ${like} ESCAPE '\\'
        )
      GROUP BY t.id
      ORDER BY GREATEST(
        similarity(t.title, ${trimmed}),
        similarity(t.subject, ${trimmed})
      ) DESC, t."updatedAt" DESC
    `);
    return rows.map((r) => r.id);
  },

  async index() {
    // no-op: pg_trgm はライブテーブルを直接読むため外部同期不要
  },
  async remove() {
    // no-op
  },
};
