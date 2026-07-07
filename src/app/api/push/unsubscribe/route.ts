import { NextRequest, NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current";
import { deleteSubscriptionByEndpoint } from "@/lib/notify/push-repo";

export const dynamic = "force-dynamic";

// 購読解除。endpoint 指定で購読を削除する。
export async function POST(req: NextRequest) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string") {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  await deleteSubscriptionByEndpoint(endpoint);
  return NextResponse.json({ ok: true });
}
