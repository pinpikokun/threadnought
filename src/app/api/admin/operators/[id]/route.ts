import { NextRequest, NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current";
import { updateOperator, resetOperatorPassword } from "@/lib/admin/admin-repo";
import { recordAdminAudit } from "@/lib/admin/admin-audit";

export const dynamic = "force-dynamic";

// オペレータ更新。ADMIN 限定。
// body に password があればパスワードリセット、無ければ role/isActive/accountIds を部分更新。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (actor.role !== "ADMIN") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const b = body as { password?: unknown; role?: unknown; isActive?: unknown; accountIds?: unknown };

  // 自分自身の管理者権限を失う変更(無効化・ADMINからの降格)は拒否する。
  // 最後の ADMIN が自らを締め出す事故を防ぐ(自己無効化はセッションも即失効する)。
  if (id === actor.operatorId) {
    if (b.isActive === false) {
      return NextResponse.json({ ok: false, error: "自分自身を無効化することはできません" }, { status: 400 });
    }
    if (typeof b.role === "string" && b.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "自分自身の管理者権限は外せません" }, { status: 400 });
    }
  }

  const res =
    typeof b.password === "string"
      ? await resetOperatorPassword(id, b.password)
      : await updateOperator(id, {
          role: b.role,
          isActive: typeof b.isActive === "boolean" ? b.isActive : undefined,
          accountIds: Array.isArray(b.accountIds) ? (b.accountIds as string[]) : undefined,
        });

  if (res.kind === "ok") {
    await recordAdminAudit({
      actorId: actor.operatorId,
      action: typeof b.password === "string" ? "OPERATOR_PASSWORD_RESET" : "OPERATOR_UPDATED",
      targetType: "operator",
      targetId: id,
    });
    return NextResponse.json({ ok: true });
  }
  if (res.kind === "invalid") return NextResponse.json({ ok: false, error: res.reason }, { status: 400 });
  return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
}
