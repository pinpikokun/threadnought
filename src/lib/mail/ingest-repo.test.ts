import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { prismaIngestRepository as repo } from "./ingest-repo";
import { ingestEmail } from "./ingest";
import { makeEmail } from "./fakes";

const ACC = { accountId: "", prefix: "ITST" };

afterAll(async () => {
  await prisma.message.deleteMany({ where: { ticket: { caseNumber: { startsWith: "ITST-" } } } });
  await prisma.auditLog.deleteMany({ where: { ticket: { caseNumber: { startsWith: "ITST-" } } } });
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: "ITST-" } } });
  await prisma.counter.deleteMany({ where: { prefix: "ITST" } });
  if (ACC.accountId) {
    await prisma.mailAccount.delete({ where: { id: ACC.accountId } });
  }
});

describe("prismaIngestRepository", () => {
  it("新着→作成、返信→追加、重複→スキップ を実DBで満たす", async () => {
    const acc = await prisma.mailAccount.create({ data: { name: "統合テスト窓口", casePrefix: "ITST", config: {} }, select: { id: true } });
    ACC.accountId = acc.id;

    const c = await ingestEmail(makeEmail({ messageId: "<it-a@x>", subject: "初回" }), ACC, repo);
    expect(c.kind).toBe("created");

    const a = await ingestEmail(makeEmail({ messageId: "<it-b@x>", references: ["<it-a@x>"] }), ACC, repo);
    expect(a.kind).toBe("appended");

    const d = await ingestEmail(makeEmail({ messageId: "<it-a@x>" }), ACC, repo);
    expect(d.kind).toBe("skipped_duplicate");

  });
});
