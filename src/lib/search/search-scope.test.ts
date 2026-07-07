import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { searchTickets, getFacetCounts, type SearchActor } from "./search";

// Phase 6a 繰越(M-c)の回帰テスト: 窓口スコープの fail-closed と交差(AND)絞り込みを直接検証する。
// テキスト検索は provider を使うためここでは扱わず、スコープ/ファセット経路(非テキスト)のみを突く。
// 非重複PREFIX(SXADP/SXORC/SXFCT と前方一致しない)。
const PREFIX = "SXSCP";
let accA = "";
let accB = "";

const admin = (): SearchActor => ({ operatorId: "op-admin", role: "ADMIN", accountIds: [] });
const memberOfA = (): SearchActor => ({ operatorId: "op-a", role: "MEMBER", accountIds: [accA] });
const memberOfNone = (): SearchActor => ({ operatorId: "op-none", role: "MEMBER", accountIds: [] });

beforeAll(async () => {
  const a = await prisma.mailAccount.create({ data: { name: `${PREFIX}窓口A`, casePrefix: `${PREFIX}A`, config: {} } });
  const b = await prisma.mailAccount.create({ data: { name: `${PREFIX}窓口B`, casePrefix: `${PREFIX}B`, config: {} } });
  accA = a.id;
  accB = b.id;
  // 窓口A に2件、窓口B に1件。
  await prisma.ticket.create({ data: { caseNumber: `${PREFIX}A-000001`, token: `${PREFIX}A-000001`, title: "A1", subject: "s", accountId: accA, status: "UNHANDLED", messageCount: 0 } });
  await prisma.ticket.create({ data: { caseNumber: `${PREFIX}A-000002`, token: `${PREFIX}A-000002`, title: "A2", subject: "s", accountId: accA, status: "IN_PROGRESS", messageCount: 0 } });
  await prisma.ticket.create({ data: { caseNumber: `${PREFIX}B-000001`, token: `${PREFIX}B-000001`, title: "B1", subject: "s", accountId: accB, status: "UNHANDLED", messageCount: 0 } });
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("searchTickets 窓口スコープ(M-c回帰)", () => {
  it("非ADMINは自窓口(A)のみ見える", async () => {
    const res = await searchTickets(memberOfA(), {});
    expect(res.map((t) => t.caseNumber).sort()).toEqual([`${PREFIX}A-000001`, `${PREFIX}A-000002`]);
  });

  it("非ADMINがアクセス外窓口(B)を filter で要求しても交差で除外され漏れない", async () => {
    const res = await searchTickets(memberOfA(), { accountIds: [accB] });
    expect(res).toHaveLength(0);
  });

  it("非ADMINの filter=[A,B] は交差で A のみに絞られる", async () => {
    const res = await searchTickets(memberOfA(), { accountIds: [accA, accB] });
    expect(res.map((t) => t.caseNumber).sort()).toEqual([`${PREFIX}A-000001`, `${PREFIX}A-000002`]);
  });

  it("空 accountIds の非ADMINは fail-closed(何も見えない)", async () => {
    const res = await searchTickets(memberOfNone(), {});
    expect(res).toHaveLength(0);
  });

  it("ADMIN は全窓口が見える(A/B を含む)", async () => {
    const res = await searchTickets(admin(), {});
    const nums = res.map((t) => t.caseNumber);
    expect(nums).toContain(`${PREFIX}A-000001`);
    expect(nums).toContain(`${PREFIX}B-000001`);
  });

  it("ADMIN は filter.accountIds で窓口を絞り込める(A 指定で B は出ない)", async () => {
    const res = await searchTickets(admin(), { accountIds: [accA] });
    const nums = res.map((t) => t.caseNumber).sort();
    expect(nums).toEqual([`${PREFIX}A-000001`, `${PREFIX}A-000002`]);
  });

  it("ピン留めは更新順より優先して先頭に並ぶ", async () => {
    // A-000001 は先に作成(=updatedAt が古い)ため、ピン無しでは A-000002 が先頭。
    await prisma.ticket.update({ where: { caseNumber: `${PREFIX}A-000001` }, data: { isPinned: true } });
    try {
      const res = await searchTickets(memberOfA(), {});
      expect(res[0].caseNumber).toBe(`${PREFIX}A-000001`);
      expect(res[0].isPinned).toBe(true);
    } finally {
      await prisma.ticket.update({ where: { caseNumber: `${PREFIX}A-000001` }, data: { isPinned: false } });
    }
  });
});

describe("getFacetCounts 窓口スコープ(M-c回帰)", () => {
  it("非ADMINの件数は自窓口(A)に閉じる", async () => {
    const f = await getFacetCounts(memberOfA());
    expect(f.total).toBe(2);
    expect(f.accounts.map((a) => a.id).sort()).toEqual([accA]);
  });

  it("ADMIN の窓口ファセットは A/B 両方を含む", async () => {
    const f = await getFacetCounts(admin());
    const ids = f.accounts.map((a) => a.id);
    expect(ids).toContain(accA);
    expect(ids).toContain(accB);
  });
});
