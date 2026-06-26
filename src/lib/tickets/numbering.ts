import { prisma } from "@/lib/prisma";

export async function nextCaseNumber(prefix: string): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { prefix },
    create: { prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(counter.value).padStart(6, "0")}`;
}
