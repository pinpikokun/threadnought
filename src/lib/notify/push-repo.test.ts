import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveSubscription, listSubscriptionsForOperators, deleteSubscriptionByEndpoint } from "./push-repo";

const PREFIX = "PUSHR";
let operatorId = "";

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: { username: `${PREFIX}-op`, displayName: `${PREFIX}担当`, passwordHash: "x", role: "MEMBER" },
  });
  operatorId = op.id;
});

afterAll(async () => {
  await prisma.pushSubscription.deleteMany({ where: { endpoint: { startsWith: PREFIX } } });
  await prisma.operator.deleteMany({ where: { username: { contains: PREFIX } } });
  await prisma.$disconnect();
});

describe("push-repo", () => {
  it("保存→操作者の購読として取得できる", async () => {
    await saveSubscription(operatorId, { endpoint: `${PREFIX}-ep1`, p256dh: "k1", auth: "a1" });
    const subs = await listSubscriptionsForOperators([operatorId]);
    const mine = subs.find((s) => s.endpoint === `${PREFIX}-ep1`);
    expect(mine).toBeDefined();
    expect(mine!.p256dh).toBe("k1");
  });

  it("同一 endpoint は upsert され重複しない(鍵は更新)", async () => {
    await saveSubscription(operatorId, { endpoint: `${PREFIX}-ep1`, p256dh: "k2", auth: "a2" });
    const subs = await listSubscriptionsForOperators([operatorId]);
    const mine = subs.filter((s) => s.endpoint === `${PREFIX}-ep1`);
    expect(mine).toHaveLength(1);
    expect(mine[0].p256dh).toBe("k2");
  });

  it("endpoint 指定で削除できる", async () => {
    await deleteSubscriptionByEndpoint(`${PREFIX}-ep1`);
    const subs = await listSubscriptionsForOperators([operatorId]);
    expect(subs.find((s) => s.endpoint === `${PREFIX}-ep1`)).toBeUndefined();
  });

  it("空の endpoint/鍵は保存しない", async () => {
    await saveSubscription(operatorId, { endpoint: "", p256dh: "x", auth: "y" });
    const subs = await listSubscriptionsForOperators([operatorId]);
    expect(subs).toHaveLength(0);
  });

  it("空の operatorIds は空配列", async () => {
    expect(await listSubscriptionsForOperators([])).toEqual([]);
  });
});
