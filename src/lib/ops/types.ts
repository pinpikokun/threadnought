import type { Role, AuditAction } from "@/generated/prisma/client";

export type Actor = { operatorId: string; role: Role };

export type AuditEntry = {
  action: AuditAction;
  fromValue?: string;
  toValue?: string;
};

// 純粋な決定関数の結果。patch は各操作固有の更新内容。
export type Decision<Patch> =
  | { kind: "apply"; patch: Patch; audits: AuditEntry[] }
  | { kind: "noop" }
  | { kind: "forbidden" }
  | { kind: "invalid"; reason: string };

// リポジトリ層の結果。ルートがHTTPへ写像する。
export type OpResult =
  | { kind: "ok"; changed: boolean }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "invalid"; reason: string };
