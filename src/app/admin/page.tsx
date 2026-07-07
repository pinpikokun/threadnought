import { redirect, notFound } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current";
import { listOperators, listAccounts } from "@/lib/admin/admin-repo";
import { AppHeader } from "../app-header";
import { CreateOperatorForm, OperatorRowEditor } from "./admin-parts";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  // ADMIN 以外には存在を見せない(404 に潰す)。
  if (actor.role !== "ADMIN") notFound();

  const [operators, accounts] = await Promise.all([listOperators(), listAccounts()]);

  return (
    <>
      <AppHeader actor={actor} />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "1rem" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 1rem" }}>設定 · オペレータ管理</h1>

        <CreateOperatorForm accounts={accounts} />

        <h2 style={{ fontSize: 15, margin: "0 0 .75rem" }}>オペレータ一覧（{operators.length}名）</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
          {operators.map((op) => (
            <OperatorRowEditor key={op.id} op={op} accounts={accounts} />
          ))}
        </div>
      </main>
    </>
  );
}
