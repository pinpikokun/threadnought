import { redirect, notFound } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current";
import { listOperators, listAccounts, listLabels, listAccountsDetail } from "@/lib/admin/admin-repo";
import { listAdminAudits } from "@/lib/admin/admin-audit";
import { t } from "@/lib/i18n/ja";
import { AppHeader } from "../app-header";
import { CreateOperatorForm, OperatorRowEditor, LabelManager, AccountManager } from "./admin-parts";

export const dynamic = "force-dynamic";

// targetType(operator/label/account) を日本語ラベルへ。未知値はそのまま返す。
function targetLabel(targetType: string): string {
  return (t.adminTargetLabel as Record<string, string>)[targetType] ?? targetType;
}

export default async function AdminPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  // ADMIN 以外には存在を見せない(404 に潰す)。
  if (actor.role !== "ADMIN") notFound();

  const [operators, accounts, labels, accountsDetail, audits] = await Promise.all([
    listOperators(),
    listAccounts(),
    listLabels(),
    listAccountsDetail(),
    listAdminAudits(100),
  ]);

  return (
    <>
      <AppHeader actor={actor} />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "1rem" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 1rem" }}>設定</h1>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: 16, margin: "0 0 .75rem" }}>オペレータ管理</h2>
          <CreateOperatorForm accounts={accounts} />
          <h3 style={{ fontSize: 14, margin: "0 0 .75rem", color: "#555" }}>一覧（{operators.length}名）</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
            {operators.map((op) => (
              <OperatorRowEditor key={op.id} op={op} accounts={accounts} />
            ))}
          </div>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: 16, margin: "0 0 .75rem" }}>窓口管理</h2>
          <AccountManager accounts={accountsDetail} />
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: 16, margin: "0 0 .75rem" }}>ラベル管理</h2>
          <LabelManager labels={labels} />
        </section>

        <section>
          <h2 style={{ fontSize: 16, margin: "0 0 .75rem" }}>監査ログ</h2>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 .5rem" }}>設定操作の履歴（最新100件）</p>
          {audits.length === 0 ? (
            <p style={{ fontSize: 13, color: "#888" }}>まだ記録はありません</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc", color: "#555" }}>
                  <th style={{ padding: ".4rem", whiteSpace: "nowrap" }}>日時</th>
                  <th style={{ padding: ".4rem" }}>操作者</th>
                  <th style={{ padding: ".4rem" }}>操作</th>
                  <th style={{ padding: ".4rem" }}>対象</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: ".4rem", whiteSpace: "nowrap", color: "#666" }}>{a.createdAt.toLocaleString("ja-JP")}</td>
                    <td style={{ padding: ".4rem" }}>{a.actorName}</td>
                    <td style={{ padding: ".4rem" }}>{t.adminAuditLabel[a.action]}</td>
                    <td style={{ padding: ".4rem" }}>
                      {targetLabel(a.targetType)}
                      {a.summary ? <span style={{ color: "#666" }}>：{a.summary}</span> : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
