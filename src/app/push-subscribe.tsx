"use client";

import { useEffect, useState } from "react";

// VAPID 公開鍵(base64url)を applicationServerKey 用の ArrayBuffer へ変換する。
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

const btnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 15,
  lineHeight: 1,
  padding: ".2rem",
};

// ブラウザプッシュ通知の購読トグル。未対応/Web Push無効(公開鍵なし)なら何も出さない。
export function PushSubscribeToggle() {
  const [supported, setSupported] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    fetch("/api/push/public-key")
      .then((r) => r.json())
      .then((d) => setPublicKey(d.publicKey ?? null))
      .catch(() => {});
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  if (!supported || !publicKey) return null;

  async function enable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey!),
      });
      const json = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      });
      setSubscribed(true);
    } catch {
      // 権限拒否や購読失敗は黙って無視(トグルは元のまま)。
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      // 無視
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={subscribed ? disable : enable}
      disabled={busy}
      title={subscribed ? "ブラウザ通知を無効化" : "ブラウザ通知を有効化"}
      aria-label={subscribed ? "ブラウザ通知を無効化" : "ブラウザ通知を有効化"}
      style={{ ...btnStyle, color: subscribed ? "#2563eb" : "#9ca3af" }}
    >
      {subscribed ? "🔔" : "🔕"}
    </button>
  );
}
