import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { nextCaseNumber } from "./numbering";

// 並列ファイル実行下で他テストのCounterを壊さないよう、本テスト専用の一意な接頭辞のみを扱う。
// (以前は where 無しの counter.deleteMany() が全カウンタを消し、merge-split 等の採番を破壊していた)
const P1 = "NUMTSUP";
const P2 = "NUMTA";

describe("nextCaseNumber", () => {
  beforeEach(async () => {
    await prisma.counter.deleteMany({ where: { prefix: { in: [P1, P2] } } });
  });

  afterAll(async () => {
    await prisma.counter.deleteMany({ where: { prefix: { in: [P1, P2] } } });
    await prisma.$disconnect();
  });

  it("接頭辞ごとに連番をゼロ埋め6桁で発行する", async () => {
    expect(await nextCaseNumber(P1)).toBe(`${P1}-000001`);
    expect(await nextCaseNumber(P1)).toBe(`${P1}-000002`);
    expect(await nextCaseNumber(P2)).toBe(`${P2}-000001`);
  });
});
