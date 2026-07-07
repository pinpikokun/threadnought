"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/ja";
import type { Role } from "@/generated/prisma/client";

type Operator = { id: string; displayName: string };
type LabelChip = { id: string; name: string; color: string };

const selectStyle: CSSProperties = { fontSize: 13, padding: ".2rem .4rem" };
const errStyle: CSSProperties = { color: "#dc2626", fontSize: 12 };

// 担当者の割当/解除。ADMIN/DISPATCHER は誰でも選択可、MEMBER は自分の担当化のみ。
// 最終的な権限判定はサーバー(decideAssigneeChange)が担保。UIの出し分けはUX目的。
export function AssigneeControl({
  ticketId,
  currentAssigneeId,
  operators,
  actorRole,
  actorOperatorId,
}: {
  ticketId: string;
  currentAssigneeId: string | null;
  operators: Operator[];
  actorRole: Role;
  actorOperatorId: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(assigneeId: string | null) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/assignee`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "担当の変更に失敗しました");
        return;
      }
      router.refresh();
    } catch {
      setError("変更中にエラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  if (actorRole === "MEMBER") {
    const isMine = currentAssigneeId === actorOperatorId;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "#555" }}>{t.assignee}:</label>
        {isMine ? (
          <span style={{ fontSize: 13 }}>自分が担当</span>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => post(actorOperatorId)}
            style={{ fontSize: 13, padding: ".2rem .6rem", border: "1px solid #374151", borderRadius: 4, background: saving ? "#e5e7eb" : "#fff", cursor: saving ? "default" : "pointer" }}
          >
            自分を担当にする
          </button>
        )}
        {error && <span style={errStyle}>{error}</span>}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", flexWrap: "wrap" }}>
      <label style={{ fontSize: 12, color: "#555" }}>{t.assignee}:</label>
      <select
        value={currentAssigneeId ?? ""}
        disabled={saving}
        onChange={(e) => post(e.target.value === "" ? null : e.target.value)}
        style={selectStyle}
      >
        <option value="">未割り当て</option>
        {operators.map((o) => (
          <option key={o.id} value={o.id}>{o.displayName}</option>
        ))}
      </select>
      {error && <span style={errStyle}>{error}</span>}
    </span>
  );
}

// ラベルの付与/除去。付与済みは色付きチップ+×、未付与はプルダウンから追加。
export function LabelControl({
  ticketId,
  currentLabels,
  allLabels,
}: {
  ticketId: string;
  currentLabels: LabelChip[];
  allLabels: LabelChip[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentIds = new Set(currentLabels.map((l) => l.id));
  const available = allLabels.filter((l) => !currentIds.has(l.id));

  async function post(op: "add" | "remove", labelId: string) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/labels`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op, labelId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "ラベルの変更に失敗しました");
        return;
      }
      router.refresh();
    } catch {
      setError("変更中にエラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", flexWrap: "wrap" }}>
      <label style={{ fontSize: 12, color: "#555" }}>ラベル:</label>
      {currentLabels.map((l) => (
        <span key={l.id} style={{ display: "inline-flex", alignItems: "center", gap: ".25rem", background: l.color || "#9ca3af", color: "#fff", borderRadius: 4, padding: ".1rem .4rem", fontSize: 12 }}>
          {l.name}
          <button
            type="button"
            disabled={saving}
            onClick={() => post("remove", l.id)}
            aria-label={`${l.name} を外す`}
            style={{ background: "transparent", border: "none", color: "#fff", cursor: saving ? "default" : "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <select
          value=""
          disabled={saving}
          onChange={(e) => { if (e.target.value) post("add", e.target.value); }}
          style={selectStyle}
        >
          <option value="">＋ラベルを追加</option>
          {available.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      )}
      {error && <span style={errStyle}>{error}</span>}
    </span>
  );
}
