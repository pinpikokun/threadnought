"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

const errStyle: CSSProperties = { color: "#dc2626", fontSize: 12 };
const inputStyle: CSSProperties = { fontSize: 13, padding: ".2rem .4rem" };

async function postFields(ticketId: string, payload: object): Promise<boolean> {
  try {
    const res = await fetch(`/api/tickets/${ticketId}/fields`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    return !!(res.ok && data?.ok);
  } catch {
    return false;
  }
}

// ピン留めトグル(★/☆)。楽観更新し、失敗時は元へ戻す。
export function PinToggle({ ticketId, initial }: { ticketId: string; initial: boolean }) {
  const router = useRouter();
  const [pinned, setPinned] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !pinned;
    setPinned(next);
    setBusy(true);
    const ok = await postFields(ticketId, { isPinned: next });
    setBusy(false);
    if (!ok) setPinned(!next);
    else router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={pinned ? "ピン留めを解除" : "ピン留め"}
      aria-label={pinned ? "ピン留めを解除" : "ピン留め"}
      style={{ background: "none", border: "none", cursor: busy ? "default" : "pointer", fontSize: 18, color: pinned ? "#f59e0b" : "#9ca3af", lineHeight: 1, padding: 0 }}
    >
      {pinned ? "★" : "☆"}
    </button>
  );
}

// 件名の編集。既定は表示のみ、「編集」で入力欄を開く。
export function TitleEditor({ ticketId, initial }: { ticketId: string; initial: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (value.trim() === "") {
      setError("件名を入力してください");
      return;
    }
    setError(null);
    setBusy(true);
    const ok = await postFields(ticketId, { title: value });
    setBusy(false);
    if (!ok) {
      setError("件名の変更に失敗しました");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => { setValue(initial); setEditing(true); }} style={{ background: "none", border: "none", color: "#2563eb", fontSize: 12, cursor: "pointer", padding: 0 }}>
        件名を編集
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", flexWrap: "wrap" }}>
      <input value={value} disabled={busy} onChange={(e) => setValue(e.target.value)} style={{ ...inputStyle, minWidth: 240 }} />
      <button type="button" disabled={busy || value.trim() === ""} onClick={save} style={{ ...inputStyle, cursor: "pointer" }}>保存</button>
      <button type="button" disabled={busy} onClick={() => setEditing(false)} style={{ ...inputStyle, cursor: "pointer" }}>取消</button>
      {error && <span style={errStyle}>{error}</span>}
    </span>
  );
}

// 期日の設定/クリア。date input を変更した時点で保存する。
export function DueDateControl({ ticketId, initialIso }: { ticketId: string; initialIso: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(initialIso ? initialIso.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commit(next: string) {
    setValue(next);
    setError(null);
    setBusy(true);
    // 空はクリア(null)、それ以外は yyyy-mm-dd をそのまま送る(サーバーで Date 化)。
    const ok = await postFields(ticketId, { dueDate: next === "" ? null : next });
    setBusy(false);
    if (!ok) setError("期日の変更に失敗しました");
    else router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", flexWrap: "wrap" }}>
      <label style={{ fontSize: 12, color: "#555" }}>期日:</label>
      <input type="date" value={value} disabled={busy} onChange={(e) => commit(e.target.value)} style={inputStyle} />
      {value && (
        <button type="button" disabled={busy} onClick={() => commit("")} style={{ ...inputStyle, cursor: "pointer" }}>クリア</button>
      )}
      {error && <span style={errStyle}>{error}</span>}
    </span>
  );
}
