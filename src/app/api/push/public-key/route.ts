import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/notify/web-push";

export const dynamic = "force-dynamic";

// クライアントが購読時に使う VAPID 公開鍵。未設定(Web Push無効)なら null。
export async function GET() {
  return NextResponse.json({ publicKey: vapidPublicKey() });
}
