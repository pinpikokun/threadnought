import { NextRequest, NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current";
import { saveSubscription } from "@/lib/notify/push-repo";

export const dynamic = "force-dynamic";

// ブラウザの PushSubscription を現在の操作者に紐づけて保存する。
export async function POST(req: NextRequest) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ ok: false, error: "invalid subscription" }, { status: 400 });
  }

  await saveSubscription(actor.operatorId, { endpoint, p256dh, auth });
  return NextResponse.json({ ok: true });
}
