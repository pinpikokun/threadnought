"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/ja";
import type { Role } from "@/generated/prisma/client";
import type { OperatorRow, AccountRow, LabelRow, AccountDetailRow } from "@/lib/admin/admin-repo";

const ROLES: Role[] = ["ADMIN", "DISPATCHER", "MEMBER"];
const inputStyle: CSSProperties = { padding: ".35rem .5rem", fontSize: 13, boxSizing: "border-box" };
const btnStyle = (busy: boolean, primary = false): CSSProperties => ({
  fontSize: 13,
  padding: ".35rem .9rem",
  border: primary ? "none" : "1px solid #d1d5db",
  borderRadius: 4,
  background: busy ? "#9ca3af" : primary ? "#374151" : "#fff",
  color: primary ? "#fff" : "#374151",
  cursor: busy ? "default" : "pointer",
});
const errStyle: CSSProperties = { color: "#dc2626", fontSize: 12 };
const okStyle: CSSProperties = { color: "#16a34a", fontSize: 12 };

// 割当窓口のチェックボックス群(作成・編集で共用)。
function AccountChecks({
  accounts,
  selected,
  disabled,
  onToggle,
}: {
  accounts: AccountRow[];
  selected: Set<string>;
  disabled: boolean;
  onToggle: (id: string) => void;
}) {
  if (accounts.length === 0) return <span style={{ fontSize: 12, color: "#999" }}>窓口未登録</span>;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: ".5rem" }}>
      {accounts.map((a) => (
        <label key={a.id} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: ".2rem" }}>
          <input type="checkbox" checked={selected.has(a.id)} disabled={disabled} onChange={() => onToggle(a.id)} />
          {a.name}
        </label>
      ))}
    </span>
  );
}

// 新規オペレータ作成フォーム。
export function CreateOperatorForm({ accounts }: { accounts: AccountRow[] }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, displayName, password, role, accountIds: [...selected] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "作成に失敗しました");
        return;
      }
      setUsername("");
      setDisplayName("");
      setPassword("");
      setRole("MEMBER");
      setSelected(new Set());
      setOkMsg("オペレータを作成しました");
      router.refresh();
    } catch {
      setError("作成中にエラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "1rem", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: ".6rem", maxWidth: 640 }}>
      <h2 style={{ fontSize: 15, margin: 0 }}>オペレータを追加</h2>
      <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
        <input value={username} disabled={busy} onChange={(e) => setUsername(e.target.value)} placeholder="ユーザー名" autoComplete="off" style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
        <input value={displayName} disabled={busy} onChange={(e) => setDisplayName(e.target.value)} placeholder="表示名" style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
      </div>
      <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "center" }}>
        <input type="password" value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} placeholder="初期パスワード(8文字以上)" autoComplete="new-password" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
        <select value={role} disabled={busy} onChange={(e) => setRole(e.target.value as Role)} style={inputStyle}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{t.roleLabel[r]}</option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: 12, color: "#555" }}>
        担当窓口: <AccountChecks accounts={accounts} selected={selected} disabled={busy} onToggle={toggle} />
      </div>
      {error && <span style={errStyle}>{error}</span>}
      {okMsg && <span style={okStyle}>{okMsg}</span>}
      <div>
        <button type="submit" disabled={busy} style={btnStyle(busy, true)}>{busy ? "作成中..." : "作成"}</button>
      </div>
    </form>
  );
}

// 1オペレータの編集行: role/有効/割当窓口の保存 + パスワードリセット。
export function OperatorRowEditor({ op, accounts }: { op: OperatorRow; accounts: AccountRow[] }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(op.role);
  const [isActive, setIsActive] = useState(op.isActive);
  const [selected, setSelected] = useState<Set<string>>(new Set(op.accounts.map((a) => a.id)));
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send(payload: object, successMsg: string) {
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/operators/${op.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "更新に失敗しました");
        return;
      }
      setOkMsg(successMsg);
      router.refresh();
    } catch {
      setError("更新中にエラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: ".75rem 1rem", display: "flex", flexDirection: "column", gap: ".5rem" }}>
      <div style={{ display: "flex", gap: ".75rem", alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>{op.displayName}</strong>
        <span style={{ fontSize: 12, color: "#888" }}>@{op.username}</span>
      </div>
      <div style={{ display: "flex", gap: ".75rem", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "#555", display: "inline-flex", alignItems: "center", gap: ".3rem" }}>
          ロール:
          <select value={role} disabled={busy} onChange={(e) => setRole(e.target.value as Role)} style={inputStyle}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{t.roleLabel[r]}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, color: "#555", display: "inline-flex", alignItems: "center", gap: ".3rem" }}>
          <input type="checkbox" checked={isActive} disabled={busy} onChange={(e) => setIsActive(e.target.checked)} />
          有効
        </label>
      </div>
      <div style={{ fontSize: 12, color: "#555" }}>
        担当窓口: <AccountChecks accounts={accounts} selected={selected} disabled={busy} onToggle={toggle} />
      </div>
      <div style={{ display: "flex", gap: ".75rem", alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" disabled={busy} onClick={() => send({ role, isActive, accountIds: [...selected] }, "保存しました")} style={btnStyle(busy, true)}>
          保存
        </button>
        <span style={{ display: "inline-flex", gap: ".3rem", alignItems: "center" }}>
          <input type="password" value={pw} disabled={busy} onChange={(e) => setPw(e.target.value)} placeholder="新パスワード" autoComplete="new-password" style={{ ...inputStyle, width: 160 }} />
          <button type="button" disabled={busy || pw.length === 0} onClick={() => { send({ password: pw }, "パスワードを更新しました"); setPw(""); }} style={btnStyle(busy || pw.length === 0)}>
            パスワード更新
          </button>
        </span>
      </div>
      {error && <span style={errStyle}>{error}</span>}
      {okMsg && <span style={okStyle}>{okMsg}</span>}
    </div>
  );
}

// ラベル管理: 作成 + 各ラベルの改名/改色/削除。
export function LabelManager({ labels }: { labels: LabelRow[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#9ca3af");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: "POST" | "DELETE", payload?: object): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: payload ? { "content-type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "操作に失敗しました");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("操作中にエラーが発生しました");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (await call("/api/admin/labels", "POST", { name: newName, color: newColor })) {
      setNewName("");
      setNewColor("#9ca3af");
    }
  }

  return (
    <div>
      <form onSubmit={onCreate} style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap", marginBottom: ".75rem" }}>
        <input value={newName} disabled={busy} onChange={(e) => setNewName(e.target.value)} placeholder="ラベル名" style={{ ...inputStyle, minWidth: 160 }} />
        <input type="color" value={newColor} disabled={busy} onChange={(e) => setNewColor(e.target.value)} title="色" style={{ width: 40, height: 30, padding: 0, border: "1px solid #d1d5db", borderRadius: 4 }} />
        <button type="submit" disabled={busy || newName.trim() === ""} style={btnStyle(busy || newName.trim() === "", true)}>ラベルを追加</button>
      </form>
      {error && <p style={{ ...errStyle, margin: "0 0 .5rem" }}>{error}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
        {labels.map((l) => (
          <LabelRowEditor key={l.id} label={l} busy={busy} onSave={(name, color) => call(`/api/admin/labels/${l.id}`, "POST", { name, color })} onDelete={() => call(`/api/admin/labels/${l.id}`, "DELETE")} />
        ))}
        {labels.length === 0 && <span style={{ fontSize: 12, color: "#999" }}>ラベルはまだありません</span>}
      </div>
    </div>
  );
}

function LabelRowEditor({
  label,
  busy,
  onSave,
  onDelete,
}: {
  label: LabelRow;
  busy: boolean;
  onSave: (name: string, color: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color || "#9ca3af");

  return (
    <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ width: 14, height: 14, borderRadius: 3, background: label.color || "#9ca3af", display: "inline-block" }} />
      <input value={name} disabled={busy} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, minWidth: 160 }} />
      <input type="color" value={color} disabled={busy} onChange={(e) => setColor(e.target.value)} title="色" style={{ width: 40, height: 30, padding: 0, border: "1px solid #d1d5db", borderRadius: 4 }} />
      <button type="button" disabled={busy || name.trim() === ""} onClick={() => onSave(name, color)} style={btnStyle(busy || name.trim() === "")}>保存</button>
      <button type="button" disabled={busy} onClick={() => { if (window.confirm(`ラベル「${label.name}」を削除します。よろしいですか？`)) onDelete(); }} style={{ ...btnStyle(busy), color: "#dc2626", borderColor: "#fca5a5" }}>削除</button>
    </div>
  );
}

// 窓口(MailAccount)管理: 作成 + 各窓口の名前/署名編集。
// casePrefix(採番接頭辞)は作成時のみ。IMAP/SMTP認証情報(config)編集は対象外。
export function AccountManager({ accounts }: { accounts: AccountDetailRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [casePrefix, setCasePrefix] = useState("");
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, casePrefix, signature }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "作成に失敗しました");
        return;
      }
      setName("");
      setCasePrefix("");
      setSignature("");
      setOkMsg("窓口を作成しました");
      router.refresh();
    } catch {
      setError("作成中にエラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={onCreate} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "1rem", marginBottom: "1rem", display: "flex", flexDirection: "column", gap: ".6rem", maxWidth: 640 }}>
        <h3 style={{ fontSize: 14, margin: 0, color: "#555" }}>窓口を追加</h3>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap" }}>
          <input value={name} disabled={busy} onChange={(e) => setName(e.target.value)} placeholder="窓口名" style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
          <input value={casePrefix} disabled={busy} onChange={(e) => setCasePrefix(e.target.value)} placeholder="採番接頭辞 (例 SUP)" style={{ ...inputStyle, width: 160 }} />
        </div>
        <textarea value={signature} disabled={busy} onChange={(e) => setSignature(e.target.value)} rows={2} placeholder="署名(任意)" style={{ ...inputStyle, resize: "vertical" }} />
        <div style={{ fontSize: 11, color: "#999" }}>
          採番接頭辞は作成後に変更できません。IMAP/SMTP の接続情報は別途設定します。
        </div>
        {error && <span style={errStyle}>{error}</span>}
        {okMsg && <span style={okStyle}>{okMsg}</span>}
        <div>
          <button type="submit" disabled={busy || name.trim() === "" || casePrefix.trim() === ""} style={btnStyle(busy || name.trim() === "" || casePrefix.trim() === "", true)}>作成</button>
        </div>
      </form>
      <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
        {accounts.map((a) => (
          <AccountRowEditor key={a.id} account={a} />
        ))}
        {accounts.length === 0 && <span style={{ fontSize: 12, color: "#999" }}>窓口はまだありません</span>}
      </div>
    </div>
  );
}

function AccountRowEditor({ account }: { account: AccountDetailRow }) {
  const router = useRouter();
  const [name, setName] = useState(account.name);
  const [signature, setSignature] = useState(account.signature);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/accounts/${account.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, signature }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "更新に失敗しました");
        return;
      }
      setOkMsg("保存しました");
      router.refresh();
    } catch {
      setError("更新中にエラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: ".75rem 1rem", display: "flex", flexDirection: "column", gap: ".5rem" }}>
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, background: "#f3f4f6", borderRadius: 4, padding: ".1rem .4rem", fontFamily: "var(--font-geist-mono, monospace)" }}>{account.casePrefix}</span>
        <input value={name} disabled={busy} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
        <span style={{ fontSize: 11, color: "#999" }}>チケット{account.ticketCount} · 担当{account.operatorCount}</span>
      </div>
      <textarea value={signature} disabled={busy} onChange={(e) => setSignature(e.target.value)} rows={2} placeholder="署名(任意)" style={{ ...inputStyle, resize: "vertical" }} />
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
        <button type="button" disabled={busy || name.trim() === ""} onClick={onSave} style={btnStyle(busy || name.trim() === "", true)}>保存</button>
        {error && <span style={errStyle}>{error}</span>}
        {okMsg && <span style={okStyle}>{okMsg}</span>}
      </div>
    </div>
  );
}
