import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { listTickets } from "./tickets";

describe("listTickets", () => {
  it("シード済みのチケットを一覧用の形で返す", async () => {
    const tickets = await listTickets({ role: "ADMIN", accountIds: [] });
    expect(tickets.length).toBeGreaterThanOrEqual(2);
    const t = tickets.find((x) => x.caseNumber === "SUP-000001");
    expect(t).toBeTruthy();
    expect(t!.title).toBe("お問い合わせの件");
    expect(t!.assigneeName).toBe("田中");
    expect(t!.messageCount).toBe(1);
  });
});

describe("listTickets（窓口スコープ）", () => {
  const PREFIX = "TLST";
  let accA = "";
  let accB = "";

  beforeAll(async () => {
    const a = await prisma.mailAccount.create({ data: { name: `${PREFIX}-accA`, casePrefix: `${PREFIX}1`, config: {} } });
    const b = await prisma.mailAccount.create({ data: { name: `${PREFIX}-accB`, casePrefix: `${PREFIX}2`, config: {} } });
    accA = a.id;
    accB = b.id;
    await prisma.ticket.create({
      data: {
        caseNumber: `${PREFIX}1-000001`, token: `${PREFIX}1-000001`, title: "窓口A案件", subject: "窓口Aの件",
        accountId: accA,
      },
    });
    await prisma.ticket.create({
      data: {
        caseNumber: `${PREFIX}2-000001`, token: `${PREFIX}2-000001`, title: "窓口B案件", subject: "窓口Bの件",
        accountId: accB,
      },
    });
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
    await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("MEMBERは自分の窓口のチケットのみ見える", async () => {
    const tickets = await listTickets({ role: "MEMBER", accountIds: [accA] });
    const caseNumbers = tickets.map((x) => x.caseNumber);
    expect(caseNumbers).toContain(`${PREFIX}1-000001`);
    expect(caseNumbers).not.toContain(`${PREFIX}2-000001`);
  });

  it("ADMINは全窓口のチケットが見える", async () => {
    const tickets = await listTickets({ role: "ADMIN", accountIds: [] });
    const caseNumbers = tickets.map((x) => x.caseNumber);
    expect(caseNumbers).toContain(`${PREFIX}1-000001`);
    expect(caseNumbers).toContain(`${PREFIX}2-000001`);
  });
});
