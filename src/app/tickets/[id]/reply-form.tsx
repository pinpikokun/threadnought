"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { parseAddressList } from "@/lib/mail/address-input";

const inputStyle: CSSProperties = { width: "100%", padding: ".4rem", fontSize: 13, boxSizing: "border-box" };

export function ReplyForm({ ticketId, defaultTo }: { ticketId: string; defaultTo: string }) {
  const router = useRouter();
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [body, setBody] = useState("");
  const [includeQuote, setIncludeQuote] = useState(true);
  const [showCcBcc, setShowCcBcc] = useState(false);
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
    const payload: {
      bodyText: string;
      to?: { address: string }[];
      cc?: { address: string }[];
      bcc?: { address: string }[];
      includeQuote: boolean;
    } = { bodyText: body, includeQuote };
    const toList = parseAddressList(to);
    const ccList = parseAddressList(cc);
    const bccList = parseAddressList(bcc);
    if (toList.length > 0) payload.to = toList;
    if (ccList.length > 0) payload.cc = ccList;
    if (bccList.length > 0) payload.bcc = bccList;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "送信に失敗しました");
        return;
      }
      setBody("");
      setCc("");
      setBcc("");
      setOkMsg("返信を送信しました");
      router.refresh();
    } catch {
      setError("送信中にエラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ borderTop: "1px solid #ddd", marginTop: "1.5rem", paddingTop: "1rem" }}>
      <h2 style={{ fontSize: 15, margin: "0 0 .5rem" }}>返信を作成</h2>
      <label style={{ display: "block", fontSize: 12, color: "#555" }}>宛先(To)</label>
      <input value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} placeholder="宛先メールアドレス(カンマ区切りで複数可)" />
      {!showCcBcc && (
        <button type="button" onClick={() => setShowCcBcc(true)} style={{ fontSize: 12, marginTop: ".25rem", background: "none", border: "none", color: "#2563eb", cursor: "pointer", padding: 0 }}>
          CC / BCC を追加
        </button>
      )}
      {showCcBcc && (
        <div style={{ marginTop: ".25rem" }}>
          <label style={{ display: "block", fontSize: 12, color: "#555" }}>CC</label>
          <input value={cc} onChange={(e) => setCc(e.target.value)} style={inputStyle} />
          <label style={{ display: "block", fontSize: 12, color: "#555", marginTop: ".25rem" }}>BCC</label>
          <input value={bcc} onChange={(e) => setBcc(e.target.value)} style={inputStyle} />
        </div>
      )}
      <label style={{ display: "block", fontSize: 12, color: "#555", marginTop: ".5rem" }}>本文</label>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} style={{ ...inputStyle, resize: "vertical" }} placeholder="返信本文を入力(署名と引用はサーバーで自動付与されます)" />
      <label style={{ display: "flex", alignItems: "center", gap: ".35rem", fontSize: 13, marginTop: ".5rem" }}>
        <input type="checkbox" checked={includeQuote} onChange={(e) => setIncludeQuote(e.target.checked)} />
        元メールを引用する
      </label>
      {error && <p style={{ color: "#dc2626", fontSize: 13, margin: ".5rem 0 0" }}>{error}</p>}
      {okMsg && <p style={{ color: "#16a34a", fontSize: 13, margin: ".5rem 0 0" }}>{okMsg}</p>}
      <div style={{ marginTop: ".75rem" }}>
        <button type="submit" disabled={submitting} style={{ padding: ".5rem 1.25rem", fontSize: 14, background: submitting ? "#9ca3af" : "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: submitting ? "default" : "pointer" }}>
          {submitting ? "送信中..." : "送信"}
        </button>
      </div>
    </form>
  );
}
