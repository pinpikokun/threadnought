"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/ja";
import type { TicketStatus, NoteType } from "@/generated/prisma/client";

const inputStyle: CSSProperties = { width: "100%", padding: ".4rem", fontSize: 13, boxSizing: "border-box" };

const STATUS_ORDER: TicketStatus[] = ["UNHANDLED", "IN_PROGRESS", "DONE"];
const NOTE_ORDER: NoteType[] = ["INTERNAL_NOTE", "EXTERNAL_LOG"];

export function StatusControl({ ticketId, current }: { ticketId: string; current: TicketStatus }) {
  const router = useRouter();
  const [value, setValue] = useState<TicketStatus>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(next: TicketStatus) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setValue(prev);
        setError(data?.error ?? "ステータスの変更に失敗しました");
        return;
      }
      router.refresh();
    } catch {
      setValue(prev);
      setError("変更中にエラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", flexWrap: "wrap" }}>
      <label style={{ fontSize: 12, color: "#555" }}>{t.status}:</label>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => onChange(e.target.value as TicketStatus)}
        style={{ fontSize: 13, padding: ".2rem .4rem" }}
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>{t.statusLabel[s]}</option>
        ))}
      </select>
      {error && <span style={{ color: "#dc2626", fontSize: 12 }}>{error}</span>}
    </span>
  );
}

export function AddNoteForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [type, setType] = useState<NoteType>("INTERNAL_NOTE");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    if (body.trim() === "") {
      setError("本文を入力してください");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "メモの追加に失敗しました");
        return;
      }
      setBody("");
      setOkMsg("メモを追加しました");
      router.refresh();
    } catch {
      setError("追加中にエラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ borderTop: "1px solid #ddd", marginTop: "1.5rem", paddingTop: "1rem" }}>
      <h2 style={{ fontSize: 15, margin: "0 0 .5rem" }}>メモ / 対応ログを追加</h2>
      <label style={{ display: "block", fontSize: 12, color: "#555" }}>種別</label>
      <select value={type} disabled={submitting} onChange={(e) => setType(e.target.value as NoteType)} style={{ fontSize: 13, padding: ".2rem .4rem", marginBottom: ".5rem" }}>
        {NOTE_ORDER.map((n) => (
          <option key={n} value={n}>{t.noteTypeLabel[n]}</option>
        ))}
      </select>
      <textarea value={body} disabled={submitting} onChange={(e) => setBody(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="社内向けのメモや、電話などメール外の対応を記録" />
      {error && <p style={{ color: "#dc2626", fontSize: 13, margin: ".5rem 0 0" }}>{error}</p>}
      {okMsg && <p style={{ color: "#16a34a", fontSize: 13, margin: ".5rem 0 0" }}>{okMsg}</p>}
      <div style={{ marginTop: ".5rem" }}>
        <button type="submit" disabled={submitting} style={{ padding: ".4rem 1rem", fontSize: 13, background: submitting ? "#9ca3af" : "#374151", color: "#fff", border: "none", borderRadius: 4, cursor: submitting ? "default" : "pointer" }}>
          {submitting ? "追加中..." : "追加"}
        </button>
      </div>
    </form>
  );
}
