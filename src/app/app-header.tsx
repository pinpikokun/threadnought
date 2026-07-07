import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { t } from "@/lib/i18n/ja";
import type { AppActor } from "@/lib/auth/current";
import { LogoutButton } from "./logout-button";

// 認証済みページ共通のヘッダー。アプリ名(一覧へのリンク)＋操作者名/ロール＋ログアウト。
// /login には表示しない(各認証ページが actor を渡して描画する)。
export async function AppHeader({ actor }: { actor: AppActor }) {
  const op = await prisma.operator.findUnique({
    where: { id: actor.operatorId },
    select: { displayName: true },
  });

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        padding: ".6rem 1rem",
        borderBottom: "1px solid #e5e7eb",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/" style={{ fontSize: 16, fontWeight: 700, color: "#111", textDecoration: "none" }}>
          Threadnought
        </Link>
        {actor.role === "ADMIN" && (
          <Link href="/admin" style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
            設定
          </Link>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: ".75rem", fontSize: 13, color: "#555" }}>
        {op && (
          <span>
            {op.displayName} · {t.roleLabel[actor.role]}
          </span>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
