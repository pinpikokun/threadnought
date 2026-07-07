import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { loadMergeCandidates } from "./lookups";

// 非重複PREFIX(既存 LKUP/NUMT/OP/MS/AUTH/SESS/TLST/SX* と前方一致しない)。
const PREFIX = "MGCND";
let accountAId = "";
let accountBId = "";
let sourceId = "";
let siblingId = "";
let trashedId = "";
let otherAccountTicketId = "";

beforeAll(async () => {
  const accA = await prisma.mailAccount.create({ data: { name: "窓口A", casePrefix: `${PREFIX}A`, config: {} } });
  const accB = await prisma.mailAccount.create({ data: { name: "窓口B", casePrefix: `${PREFIX}B`, config: {} } });
  accountAId = accA.id;
  accountBId = accB.id;

  const source = await prisma.ticket.create({
    data: { caseNumber: `${PREFIX}A-000001`, token: `${PREFIX}A-000001`, title: "統合元", subject: "S", accountId: accountAId, status: "UNHANDLED", messageCount: 0 },
  });
  sourceId = source.id;
  // 同一窓口の別チケット(候補に出るべき)。updatedAt をより新しくするため後から作成。
  const sibling = await prisma.ticket.create({
    data: { caseNumber: `${PREFIX}A-000002`, token: `${PREFIX}A-000002`, title: "統合先候補", subject: "S", accountId: accountAId, status: "UNHANDLED", messageCount: 0 },
  });
  siblingId = sibling.id;
  // ゴミ箱化済み(除外されるべき)。
  const trashed = await prisma.ticket.create({
    data: { caseNumber: `${PREFIX}A-000003`, token: `${PREFIX}A-000003`, title: "ゴミ箱", subject: "S", accountId: accountAId, status: "UNHANDLED", messageCount: 0, isTrashed: true },
  });
  trashedId = trashed.id;
  // 他窓口(除外されるべき)。
  const other = await prisma.ticket.create({
    data: { caseNumber: `${PREFIX}B-000001`, token: `${PREFIX}B-000001`, title: "他窓口", subject: "S", accountId: accountBId, status: "UNHANDLED", messageCount: 0 },
  });
  otherAccountTicketId = other.id;
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("loadMergeCandidates", () => {
  it("同一窓口の非trashedチケットを返し、自分自身/ゴミ箱/他窓口は除外する", async () => {
    const cands = await loadMergeCandidates(sourceId);
    expect(cands).not.toBeNull();
    const ids = cands!.map((c) => c.id);
    expect(ids).toContain(siblingId);
    expect(ids).not.toContain(sourceId);
    expect(ids).not.toContain(trashedId);
    expect(ids).not.toContain(otherAccountTicketId);
  });

  it("caseNumber と title を含む", async () => {
    const cands = await loadMergeCandidates(sourceId);
    const sibling = cands!.find((c) => c.id === siblingId);
    expect(sibling).toBeDefined();
    expect(sibling!.caseNumber).toBe(`${PREFIX}A-000002`);
    expect(sibling!.title).toBe("統合先候補");
  });

  it("存在しないチケットは null", async () => {
    const cands = await loadMergeCandidates("nonexistent-mgcnd-id");
    expect(cands).toBeNull();
  });
});
