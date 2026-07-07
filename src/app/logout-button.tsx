"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ログアウト：セッションを失効させてログイン画面へ戻す。
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ネットワーク失敗でもクライアント側の遷移は進める(Cookieはサーバーで失効済みの可能性)。
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={busy}
      style={{
        fontSize: 13,
        padding: ".25rem .7rem",
        border: "1px solid #d1d5db",
        borderRadius: 4,
        background: busy ? "#e5e7eb" : "#fff",
        color: "#374151",
        cursor: busy ? "default" : "pointer",
      }}
    >
      {busy ? "..." : "ログアウト"}
    </button>
  );
}
