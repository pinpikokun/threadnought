import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { searchTickets } from "./search";
import type { SearchActor } from "./search";

const PREFIX = "SRCHO";
let accountA = "";
let accountB = "";
let alice = "";
let bob = "";
let labelUrgent = "";
let tApple = "";
let tBanana = "";
let tCherry = "";
let tOther = "";
let adminAll: SearchActor;
let memberA: SearchActor;

beforeAll(async () => {
  const a = await prisma.mailAccount.create({ data: { name: "検索O窓口A", casePrefix: `${PREFIX}A`, config: {} } });
  const b = await prisma.mailAccount.create({ data: { name: "検索O窓口B", casePrefix: `${PREFIX}B`, config: {} } });
  accountA = a.id;
  accountB = b.id;
  const al = await prisma.operator.create({ data: { username: `srch-alice-${PREFIX}`, displayName: "アリス", passwordHash: "x", role: "MEMBER" } });
  const bo = await prisma.operator.create({ data: { username: `srch-bob-${PREFIX}`, displayName: "ボブ", passwordHash: "x", role: "MEMBER" } });
  alice = al.id;
  bob = bo.id;
  const lab = await prisma.label.create({ data: { name: `緊急${PREFIX}`, color: "#f00" } });
  labelUrgent = lab.id;

  const apple = await prisma.ticket.create({
    data: {
      caseNumber: `${PREFIX}A-000001`, token: `${PREFIX}A-000001`, title: "りんご案件",
      subject: "りんごの件", accountId: accountA, status: "UNHANDLED", messageCount: 1,
      assigneeId: alice, labels: { connect: { id: labelUrgent } },
      messages: { create: { direction: "INBOUND", messageId: `<${PREFIX}-a@x.example>`, references: [], fromAddr: "a@x.example", toAddrs: ["s@x.example"], subject: "りんごの件", bodyText: "りんご本文", sentAt: new Date("2026-06-26T09:00:00Z") } },
    },
  });
  tApple = apple.id;
  const banana = await prisma.ticket.create({
    data: {
      caseNumber: `${PREFIX}A-000002`, token: `${PREFIX}A-000002`, title: "バナナ案件",
      subject: "バナナの件", accountId: accountA, status: "IN_PROGRESS", messageCount: 1,
      assigneeId: bob,
      messages: { create: { direction: "INBOUND", messageId: `<${PREFIX}-b@x.example>`, references: [], fromAddr: "b@x.example", toAddrs: ["s@x.example"], subject: "バナナの件", bodyText: "バナナ本文", sentAt: new Date("2026-06-26T10:00:00Z") } },
    },
  });
  tBanana = banana.id;
  const cherry = await prisma.ticket.create({
    data: {
      caseNumber: `${PREFIX}A-000003`, token: `${PREFIX}A-000003`, title: "さくらんぼ案件",
      subject: "さくらんぼの件", accountId: accountA, status: "DONE", messageCount: 1,
      messages: { create: { direction: "INBOUND", messageId: `<${PREFIX}-c@x.example>`, references: [], fromAddr: "c@x.example", toAddrs: ["s@x.example"], subject: "さくらんぼの件", bodyText: "さくらんぼ本文", sentAt: new Date("2026-06-26T11:00:00Z") } },
    },
  });
  tCherry = cherry.id;
  const other = await prisma.ticket.create({
    data: {
      caseNumber: `${PREFIX}B-000001`, token: `${PREFIX}B-000001`, title: "別窓口りんご",
      subject: "別窓口りんごの件", accountId: accountB, status: "UNHANDLED", messageCount: 1,
      messages: { create: { direction: "INBOUND", messageId: `<${PREFIX}-o@x.example>`, references: [], fromAddr: "o@x.example", toAddrs: ["s@x.example"], subject: "別窓口りんごの件", bodyText: "りんご本文", sentAt: new Date("2026-06-26T12:00:00Z") } },
    },
  });
  tOther = other.id;

  adminAll = { operatorId: "admin-x", role: "ADMIN", accountIds: [] };
  memberA = { operatorId: alice, role: "MEMBER", accountIds: [accountA] };
});

afterAll(async () => {
  await prisma.message.deleteMany({ where: { ticket: { caseNumber: { startsWith: PREFIX } } } });
  for (const id of [tApple, tBanana, tCherry, tOther]) {
    await prisma.ticket.update({ where: { id }, data: { labels: { set: [] } } });
  }
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
  await prisma.label.deleteMany({ where: { name: { startsWith: `緊急${PREFIX}` } } });
  await prisma.operator.deleteMany({ where: { username: { startsWith: "srch-" } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("searchTickets", () => {
  it("フィルタ無しなら窓口内の全チケットを更新降順で返す", async () => {
    const items = await searchTickets(memberA, {});
    const ids = items.map((i) => i.id);
    expect(ids).toContain(tApple);
    expect(ids).toContain(tBanana);
    expect(ids).toContain(tCherry);
    expect(ids).not.toContain(tOther); // 別窓口は不可視
  });

  it("ADMINは全窓口が見える", async () => {
    const items = await searchTickets(adminAll, {});
    const ids = items.map((i) => i.id);
    expect(ids).toContain(tApple);
    expect(ids).toContain(tOther);
  });

  it("テキスト検索で一致チケットに絞る", async () => {
    const items = await searchTickets(memberA, { text: "さくらんぼ" });
    const ids = items.map((i) => i.id);
    expect(ids).toEqual([tCherry]);
  });

  it("ステータスファセットで絞る", async () => {
    const items = await searchTickets(memberA, { status: ["DONE"] });
    expect(items.map((i) => i.id)).toEqual([tCherry]);
  });

  it("担当ファセット(operatorId)で絞る", async () => {
    const items = await searchTickets(memberA, { assignee: bob });
    expect(items.map((i) => i.id)).toEqual([tBanana]);
  });

  it("未割り当てファセットで絞る", async () => {
    const items = await searchTickets(memberA, { assignee: "unassigned" });
    expect(items.map((i) => i.id)).toEqual([tCherry]);
  });

  it("ラベルファセットで絞る", async () => {
    const items = await searchTickets(memberA, { labelIds: [labelUrgent] });
    expect(items.map((i) => i.id)).toEqual([tApple]);
  });

  it("テキストとファセットはAND結合", async () => {
    const items = await searchTickets(memberA, { text: "りんご", status: ["DONE"] });
    expect(items).toEqual([]); // りんごはUNHANDLEDなのでDONEと両立しない
  });

  it("accountId facet は自分のアクセス窓口に限定される", async () => {
    // memberA は accountB を持たないので、accountB を要求しても空
    const items = await searchTickets(memberA, { accountIds: [accountB] });
    expect(items).toEqual([]);
  });
});
