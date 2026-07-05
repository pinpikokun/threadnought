import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getCurrentActor();
  if (!actor) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const operator = await prisma.operator.findUnique({
    where: { id: actor.operatorId },
    select: { id: true, username: true, displayName: true, role: true, avatarUrl: true },
  });
  return NextResponse.json({ ok: true, operator, accountIds: actor.accountIds });
}
