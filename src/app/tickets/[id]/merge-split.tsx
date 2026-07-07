"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { MergeCandidate } from "@/lib/ops/lookups";

const selectStyle: CSSProperties = { fontSize: 13, padding: ".2rem .4rem", maxWidth: 360 };
const errStyle: CSSProperties = { color: "#dc2626", fontSize: 12 };
const btnStyle = (busy: boolean): CSSProperties => ({
  fontSize: 13,
  padding: ".2rem .6rem",
  border: "1px solid #374151",
  borderRadius: 4,
  background: busy ? "#e5e7eb" : "#fff",
  cursor: busy ? "default" : "pointer",
});

// 統合：このチケット(統合元)を、同一窓口の別チケット(統合先)へ吸収させる。
// 成功後は統合元がゴミ箱化されるため、統合先へ遷移する。
export function MergeControl({
  ticketId,
  candidates,
}: {
  ticketId: string;
  candidates: MergeCandidate[];
}) {
  const router = useRouter();
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 統合先の候補が無ければコントロール自体を出さない。
  if (candidates.length === 0) return null;

  async function onMerge() {
    if (!targetId) return;
    const target = candidates.find((c) => c.id === targetId);
    const label = target ? `${target.caseNumber}（${target.title}）` : "選択したチケット";
    if (!window.confirm(`このチケットを ${label} に統合します。統合元は一覧から消えます。よろしいですか？`)) {
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/merge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "統合に失敗しました");
        setSaving(false);
        return;
      }
      // 統合元は吸収済み。統合先へ移動する。
      router.push(`/tickets/${targetId}`);
    } catch {
      setError("統合中にエラーが発生しました");
      setSaving(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", flexWrap: "wrap" }}>
      <label style={{ fontSize: 12, color: "#555" }}>統合先:</label>
      <select
        value={targetId}
        disabled={saving}
        onChange={(e) => setTargetId(e.target.value)}
        style={selectStyle}
      >
        <option value="">チケットを選択</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>{c.caseNumber}｜{c.title}</option>
        ))}
      </select>
      <button type="button" disabled={saving || !targetId} onClick={onMerge} style={btnStyle(saving || !targetId)}>
        統合
      </button>
      {error && <span style={errStyle}>{error}</span>}
    </span>
  );
}

// 分割：タイムライン上の1通を、同一窓口の新規チケットへ切り出す。
// 唯一のメール(canSplit=false)では表示しない。成功後は新チケットへ遷移する。
export function SplitButton({
  ticketId,
  messageId,
  canSplit,
}: {
  ticketId: string;
  messageId: string;
  canSplit: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canSplit) return null;

  async function onSplit() {
    if (!window.confirm("このメールを新しいチケットとして切り出します。よろしいですか？")) {
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/split`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.newTicketId) {
        setError(data?.error ?? "分割に失敗しました");
        setSaving(false);
        return;
      }
      router.push(`/tickets/${data.newTicketId}`);
    } catch {
      setError("分割中にエラーが発生しました");
      setSaving(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: ".35rem" }}>
      <button type="button" disabled={saving} onClick={onSplit} style={{ ...btnStyle(saving), fontSize: 12, padding: ".1rem .5rem" }}>
        分割
      </button>
      {error && <span style={errStyle}>{error}</span>}
    </span>
  );
}
