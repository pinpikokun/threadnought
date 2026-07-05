import { NextResponse } from "next/server";
import { getSessionToken, clearSessionCookie } from "@/lib/auth/cookies";
import { deleteSession } from "@/lib/auth/session-repo";

export const dynamic = "force-dynamic";

export async function POST() {
  const token = await getSessionToken();
  if (token) await deleteSession(token);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
