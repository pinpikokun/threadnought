import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current";
import { parseSearchParams, type RawSearchParams } from "@/lib/search/params";
import { searchTickets, getFacetCounts } from "@/lib/search/search";
import { t } from "@/lib/i18n/ja";

export const dynamic = "force-dynamic";

// 現在のクエリに1つのキー=値をトグルした href を作る（AND絞り込み用）
function toggleHref(current: RawSearchParams, key: string, value: string): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) params.append(k, item);
  }
  const existing = params.getAll(key);
  if (existing.includes(value)) {
    // 既にONなら外す
    const remained = existing.filter((x) => x !== value);
    params.delete(key);
    for (const r of remained) params.append(key, r);
  } else {
    params.append(key, value);
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

function isActive(current: RawSearchParams, key: string, value: string): boolean {
  const v = current[key];
  if (v === undefined) return false;
  return Array.isArray(v) ? v.includes(value) : v === value;
}

// 担当ディメンション（クイックビュー view と 担当 assignee）は排他。
// parseSearchParams が view を assignee より優先するため、両者が同時にURLに乗ると
// 表示と実フィルタが食い違う。選択時は view/assignee を一旦落として選んだ分だけ付け直す
// （同じ選択の再クリックは off）ことで、常に片方だけがアクティブになるようにする。
function assigneeDimHref(
  current: RawSearchParams,
  selKey: "view" | "assignee",
  selValue: string,
  selActive: boolean,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v === undefined || k === "view" || k === "assignee") continue;
    for (const item of Array.isArray(v) ? v : [v]) params.append(k, item);
  }
  if (!selActive) params.append(selKey, selValue);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

function hasView(current: RawSearchParams): boolean {
  const v = current.view;
  return v !== undefined && (Array.isArray(v) ? v.length > 0 : true);
}

// 個別担当ファセットは、view が効いている間は無効（アクティブにしない）。
function assigneeFacetActive(current: RawSearchParams, opId: string): boolean {
  if (hasView(current)) return false;
  return isActive(current, "assignee", opId);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  const raw = await searchParams;
  const filter = parseSearchParams(raw, actor);
  const [tickets, facets] = await Promise.all([
    searchTickets(actor, filter),
    getFacetCounts(actor),
  ]);

  const q = (Array.isArray(raw.q) ? raw.q[0] : raw.q) ?? "";

  return (
    <main style={{ display: "flex", gap: "1.5rem", padding: "1rem", alignItems: "flex-start" }}>
      <aside style={{ width: 220, flexShrink: 0, fontSize: 14 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 .5rem" }}>絞り込み</h2>

        <section style={{ marginBottom: "1rem" }}>
          <h3 style={{ fontSize: 13, color: "#666", margin: "0 0 .25rem" }}>クイックビュー</h3>
          <FacetLink href={assigneeDimHref(raw, "view", "mine", isActive(raw, "view", "mine"))} active={isActive(raw, "view", "mine")} label="自分の担当" count={facets.quickViews.mine} />
          <FacetLink href={assigneeDimHref(raw, "view", "unassigned", isActive(raw, "view", "unassigned"))} active={isActive(raw, "view", "unassigned")} label="未割り当て" count={facets.quickViews.unassigned} />
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h3 style={{ fontSize: 13, color: "#666", margin: "0 0 .25rem" }}>ステータス</h3>
          {facets.status.map((s) => (
            <FacetLink key={s.value} href={toggleHref(raw, "status", s.value)} active={isActive(raw, "status", s.value)} label={t.statusLabel[s.value]} count={s.count} />
          ))}
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h3 style={{ fontSize: 13, color: "#666", margin: "0 0 .25rem" }}>担当</h3>
          {facets.assignees.map((a) => (
            <FacetLink key={a.operatorId} href={assigneeDimHref(raw, "assignee", a.operatorId, assigneeFacetActive(raw, a.operatorId))} active={assigneeFacetActive(raw, a.operatorId)} label={a.name} count={a.count} />
          ))}
        </section>

        {facets.labels.length > 0 && (
          <section style={{ marginBottom: "1rem" }}>
            <h3 style={{ fontSize: 13, color: "#666", margin: "0 0 .25rem" }}>ラベル</h3>
            {facets.labels.map((l) => (
              <FacetLink key={l.id} href={toggleHref(raw, "label", l.id)} active={isActive(raw, "label", l.id)} label={l.name} count={l.count} />
            ))}
          </section>
        )}

        {facets.accounts.length > 1 && (
          <section>
            <h3 style={{ fontSize: 13, color: "#666", margin: "0 0 .25rem" }}>窓口</h3>
            {facets.accounts.map((ac) => (
              <FacetLink key={ac.id} href={toggleHref(raw, "account", ac.id)} active={isActive(raw, "account", ac.id)} label={ac.name} count={ac.count} />
            ))}
          </section>
        )}
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <form method="get" style={{ marginBottom: "1rem", display: "flex", gap: ".5rem" }}>
          {/* テキスト以外のファセット選択を hidden で持ち越す */}
          {Object.entries(raw).flatMap(([k, v]) =>
            k === "q" || v === undefined
              ? []
              : (Array.isArray(v) ? v : [v]).map((item, i) => (
                  <input key={`${k}-${i}`} type="hidden" name={k} value={item} />
                )),
          )}
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="件名・本文・差出人・顧客名・番号で検索"
            style={{ flex: 1, padding: ".4rem .6rem", fontSize: 14 }}
          />
          <button type="submit" style={{ padding: ".4rem .9rem" }}>検索</button>
          {(q || Object.keys(raw).length > 0) && (
            <a href="/" style={{ padding: ".4rem .6rem", alignSelf: "center", fontSize: 13 }}>クリア</a>
          )}
        </form>

        <p style={{ fontSize: 13, color: "#666", margin: "0 0 .5rem" }}>{tickets.length} 件</p>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: ".4rem" }}>番号</th>
              <th style={{ padding: ".4rem" }}>件名</th>
              <th style={{ padding: ".4rem" }}>ステータス</th>
              <th style={{ padding: ".4rem" }}>担当</th>
              <th style={{ padding: ".4rem" }}>💬</th>
              <th style={{ padding: ".4rem" }}>更新</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((x) => (
              <tr key={x.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: ".4rem", whiteSpace: "nowrap" }}>
                  <a href={`/tickets/${x.id}`}>{x.caseNumber}</a>
                </td>
                <td style={{ padding: ".4rem" }}>{x.title}</td>
                <td style={{ padding: ".4rem" }}>{t.statusLabel[x.status]}</td>
                <td style={{ padding: ".4rem" }}>{x.assigneeName ?? "—"}</td>
                <td style={{ padding: ".4rem" }}>{x.messageCount}</td>
                <td style={{ padding: ".4rem", whiteSpace: "nowrap" }}>{x.updatedAt.toLocaleString("ja-JP")}</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "1rem", color: "#888" }}>該当するチケットはありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function FacetLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <a
      href={href}
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: ".2rem .4rem",
        borderRadius: 4,
        textDecoration: "none",
        color: active ? "#fff" : "#222",
        background: active ? "#2563eb" : "transparent",
        fontWeight: active ? 600 : 400,
      }}
    >
      <span>{label}</span>
      <span style={{ color: active ? "#dbeafe" : "#999" }}>{count}</span>
    </a>
  );
}
