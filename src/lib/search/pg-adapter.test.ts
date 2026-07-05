import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { pgTrgmSearchProvider } from "./pg-adapter";

const PREFIX = "SRCH";
let accountA = "";
let accountB = "";
let ticketApple = "";
let ticketBanana = "";
let ticketOtherWindow = "";

beforeAll(async () => {
  const a = await prisma.mailAccount.create({ data: { name: "検索窓口A", casePrefix: `${PREFIX}A`, config: {} } });
  const b = await prisma.mailAccount.create({ data: { name: "検索窓口B", casePrefix: `${PREFIX}B`, config: {} } });
  accountA = a.id;
  accountB = b.id;

  const apple = await prisma.ticket.create({
    data: {
      caseNumber: `${PREFIX}A-000001`, token: `${PREFIX}A-000001`,
      title: "りんごの出荷について", subject: "りんご在庫の問い合わせ",
      accountId: accountA, status: "UNHANDLED", messageCount: 1,
      messages: { create: {
        direction: "INBOUND", messageId: `<${PREFIX}-apple@example.com>`, references: [],
        fromAddr: "hello@apple-farm.example", toAddrs: ["support@example.com"],
        subject: "りんご在庫の問い合わせ", bodyText: "りんごを100箱注文したいです。",
        sentAt: new Date("2026-06-26T09:00:00Z"),
      } },
    },
  });
  ticketApple = apple.id;

  const banana = await prisma.ticket.create({
    data: {
      caseNumber: `${PREFIX}A-000002`, token: `${PREFIX}A-000002`,
      title: "バナナの請求書", subject: "バナナ請求の件",
      accountId: accountA, status: "IN_PROGRESS", messageCount: 1,
      messages: { create: {
        direction: "INBOUND", messageId: `<${PREFIX}-banana@example.com>`, references: [],
        fromAddr: "billing@banana.example", toAddrs: ["support@example.com"],
        subject: "バナナ請求の件", bodyText: "請求書の再発行をお願いします。",
        sentAt: new Date("2026-06-26T10:00:00Z"),
      } },
    },
  });
  ticketBanana = banana.id;

  const other = await prisma.ticket.create({
    data: {
      caseNumber: `${PREFIX}B-000001`, token: `${PREFIX}B-000001`,
      title: "りんご別窓口", subject: "りんご別窓口の件",
      accountId: accountB, status: "UNHANDLED", messageCount: 1,
      messages: { create: {
        direction: "INBOUND", messageId: `<${PREFIX}-other@example.com>`, references: [],
        fromAddr: "x@apple-farm.example", toAddrs: ["b@example.com"],
        subject: "りんご別窓口の件", bodyText: "りんごの件です。",
        sentAt: new Date("2026-06-26T11:00:00Z"),
      } },
    },
  });
  ticketOtherWindow = other.id;
});

afterAll(async () => {
  await prisma.message.deleteMany({ where: { ticket: { caseNumber: { startsWith: PREFIX } } } });
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("pgTrgmSearchProvider.search", () => {
  it("件名/タイトルの一致でチケットIDを返す", async () => {
    const ids = await pgTrgmSearchProvider.search("りんご", { role: "ADMIN", accountIds: [] });
    expect(ids).toContain(ticketApple);
    expect(ids).not.toContain(ticketBanana);
  });

  it("本文の一致でも見つかる", async () => {
    const ids = await pgTrgmSearchProvider.search("再発行", { role: "ADMIN", accountIds: [] });
    expect(ids).toContain(ticketBanana);
  });

  it("差出人アドレスの一致でも見つかる", async () => {
    const ids = await pgTrgmSearchProvider.search("banana.example", { role: "ADMIN", accountIds: [] });
    expect(ids).toContain(ticketBanana);
  });

  it("非ADMINは自窓口のみ（別窓口の一致は返さない）", async () => {
    const ids = await pgTrgmSearchProvider.search("りんご", { role: "MEMBER", accountIds: [accountA] });
    expect(ids).toContain(ticketApple);
    expect(ids).not.toContain(ticketOtherWindow);
  });

  it("非ADMINでaccountIdsが空なら何も返さない(fail-closed)", async () => {
    const ids = await pgTrgmSearchProvider.search("りんご", { role: "MEMBER", accountIds: [] });
    expect(ids).toEqual([]);
  });

  it("空文字は空配列", async () => {
    const ids = await pgTrgmSearchProvider.search("   ", { role: "ADMIN", accountIds: [] });
    expect(ids).toEqual([]);
  });

  it("index/remove は no-op（例外を投げない）", async () => {
    await expect(pgTrgmSearchProvider.index(ticketApple)).resolves.toBeUndefined();
    await expect(pgTrgmSearchProvider.remove(ticketApple)).resolves.toBeUndefined();
  });
});
