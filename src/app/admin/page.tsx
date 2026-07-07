import { redirect, notFound } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current";
import { listOperators, listAccounts, listLabels } from "@/lib/admin/admin-repo";
import { AppHeader } from "../app-header";
import { CreateOperatorForm, OperatorRowEditor, LabelManager } from "./admin-parts";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  // ADMIN 以外には存在を見せない(404 に潰す)。
  if (actor.role !== "ADMIN") notFound();

  const [operators, accounts, labels] = await Promise.all([listOperators(), listAccounts(), listLabels()]);

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

        <section>
          <h2 style={{ fontSize: 16, margin: "0 0 .75rem" }}>ラベル管理</h2>
          <LabelManager labels={labels} />
        </section>
      </main>
    </>
  );
}
