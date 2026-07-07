"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type NotifyEvent = {
  type: "ticket_created" | "message_appended" | "ticket_reopened";
  accountId: string;
  ticketId: string;
  caseNumber: string;
  title: string;
  at: number;
};

const TYPE_LABEL: Record<NotifyEvent["type"], string> = {
  ticket_created: "新規チケット",
  message_appended: "新着メール",
  ticket_reopened: "再オープン",
};

// アプリ内リアルタイム通知ベル。SSE で受信し、未読バッジとドロップダウンで見せる。
export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotifyEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    es.addEventListener("notify", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as NotifyEvent;
        setItems((prev) => [data, ...prev].slice(0, 20));
        setUnread((u) => u + 1);
      } catch {
        // 壊れたイベントは無視
      }
    });
    // 接続断は EventSource が自動再接続する。アンマウントで閉じる。
    return () => es.close();
  }, []);

  function toggle() {
    setOpen((o) => {
      if (!o) setUnread(0); // 開いたら未読をクリア
      return !o;
    });
  }

  function go(ev: NotifyEvent) {
    setOpen(false);
    router.push(`/tickets/${ev.ticketId}`);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={toggle}
        aria-label="通知"
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, position: "relative", lineHeight: 1, padding: ".2rem" }}
      >
        🔔
        {unread > 0 && (
          <span style={{ position: "absolute", top: -2, right: -4, background: "#dc2626", color: "#fff", borderRadius: 8, fontSize: 10, minWidth: 15, height: 15, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", width: 300, maxHeight: 360, overflowY: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,.12)", zIndex: 50 }}>
          <div style={{ padding: ".5rem .75rem", borderBottom: "1px solid #f3f4f6", fontSize: 13, fontWeight: 600 }}>通知</div>
          {items.length === 0 ? (
            <div style={{ padding: ".75rem", fontSize: 13, color: "#999" }}>新しい通知はありません</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((ev, i) => (
                <li key={`${ev.ticketId}-${ev.at}-${i}`}>
                  <button
                    type="button"
                    onClick={() => go(ev)}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid #f3f4f6", padding: ".5rem .75rem", cursor: "pointer", fontSize: 13 }}
                  >
                    <span style={{ color: "#2563eb", fontSize: 11 }}>{TYPE_LABEL[ev.type]}</span>
                    <div style={{ color: "#888", fontSize: 11 }}>{ev.caseNumber}</div>
                    <div style={{ color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
