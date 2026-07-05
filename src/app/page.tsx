import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current";
import { listTickets } from "@/lib/tickets";
import { t } from "@/lib/i18n/ja";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  const tickets = await listTickets(actor);
  return (
    <main style={{ padding: 24 }}>
      <h1>{t.ticketList}</h1>
      <table>
        <thead>
          <tr>
            <th>{t.caseNumber}</th><th>{t.title}</th><th>{t.status}</th>
            <th>{t.assignee}</th><th>💬</th><th>{t.updatedAt}</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((x) => (
            <tr key={x.id}>
              <td>{x.caseNumber}</td>
              <td>{x.title}</td>
              <td>{t.statusLabel[x.status]}</td>
              <td>{x.assigneeName ?? "—"}</td>
              <td>{x.messageCount}</td>
              <td>{x.updatedAt.toLocaleString("ja-JP")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
