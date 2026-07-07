import { prisma } from "@/lib/prisma";

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// 購読を保存する。endpoint は一意なので upsert。再ログイン等で別オペレータが同一端末を
// 使う場合に備え、既存 endpoint は operatorId ごと差し替える。
export async function saveSubscription(operatorId: string, sub: PushSubscriptionInput): Promise<void> {
  if (!sub.endpoint || !sub.p256dh || !sub.auth) return;
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { operatorId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
    update: { operatorId, p256dh: sub.p256dh, auth: sub.auth },
  });
}

// endpoint 指定で購読を削除する(購読解除、および配信時の 410/404 掃除に使う)。
export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

// 指定オペレータ群の購読を全て返す(配信対象の解決)。
export async function listSubscriptionsForOperators(operatorIds: string[]): Promise<StoredSubscription[]> {
  if (operatorIds.length === 0) return [];
  return prisma.pushSubscription.findMany({
    where: { operatorId: { in: operatorIds } },
    select: { endpoint: true, p256dh: true, auth: true },
  });
}
