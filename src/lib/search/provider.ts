import type { Role } from "@/generated/prisma/client";

// 検索の窓口スコープ。ADMIN は全窓口、それ以外は accountIds に限定。
export type SearchScope = { role: Role; accountIds: string[] };

// 検索ポート。標準アダプターは pg_trgm。外部検索基盤(ES等)は将来このIFを差し替える。
export interface SearchProvider {
  // フリーテキストに一致するチケットIDを関連度降順で返す。窓口スコープ適用済み。
  search(text: string, scope: SearchScope): Promise<string[]>;
  // 外部インデックスへの同期フック。ライブDB直読みの標準アダプターでは no-op。
  index(ticketId: string): Promise<void>;
  remove(ticketId: string): Promise<void>;
}
