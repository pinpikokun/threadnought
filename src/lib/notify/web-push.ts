import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { listSubscriptionsForOperators, deleteSubscriptionByEndpoint } from "./push-repo";

// VAPID 設定は env から遅延読み込みする。鍵が未設定なら Web Push は無効(SSE には影響しない)。
let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } else {
    configured = false;
  }
  return configured;
}

export function webPushEnabled(): boolean {
  return ensureConfigured();
}

export function vapidPublicKey(): string | null {
  return webPushEnabled() ? process.env.VAPID_PUBLIC_KEY ?? null : null;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

// 指定オペレータ群へ Web Push を送る(ベストエフォート)。
// 端末が失効(404/410)していたらその購読を掃除する。呼び出し側の処理は止めない。
export async function sendPushToOperators(operatorIds: string[], payload: PushPayload): Promise<void> {
  if (!webPushEnabled() || operatorIds.length === 0) return;
  const subs = await listSubscriptionsForOperators(operatorIds);
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await deleteSubscriptionByEndpoint(s.endpoint).catch(() => {});
        }
        // それ以外の失敗は握り潰す(取り込み等の本処理に影響させない)。
      }
    }),
  );
}

// この窓口の通知を受け取るべきオペレータ(有効・ADMIN または当該窓口所属)の id 一覧。
export async function recipientsForAccount(accountId: string): Promise<string[]> {
  const ops = await prisma.operator.findMany({
    where: {
      isActive: true,
      OR: [{ role: "ADMIN" }, { accounts: { some: { id: accountId } } }],
    },
    select: { id: true },
  });
  return ops.map((o) => o.id);
}
