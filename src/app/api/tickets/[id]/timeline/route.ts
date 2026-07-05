import { NextRequest, NextResponse } from "next/server";
import { loadTimeline } from "@/lib/ops/ops-repo";

export const dynamic = "force-dynamic";

// セキュリティ注記: 認証は未実装(Phase 5)。窓口アクセス制御は未適用。公開前に必ずゲートすること。
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await loadTimeline(id);
  if (items === null) {
    return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, items });
}
