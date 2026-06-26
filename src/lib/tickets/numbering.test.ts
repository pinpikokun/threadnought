import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { nextCaseNumber } from "./numbering";

describe("nextCaseNumber", () => {
  beforeEach(async () => { await prisma.counter.deleteMany(); });

  it("接頭辞ごとに連番をゼロ埋め6桁で発行する", async () => {
    expect(await nextCaseNumber("SUP")).toBe("SUP-000001");
    expect(await nextCaseNumber("SUP")).toBe("SUP-000002");
    expect(await nextCaseNumber("A")).toBe("A-000001");
  });
});
