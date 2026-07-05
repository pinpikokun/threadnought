export function validateMerge(input: { sourceId: string; targetId: string }): { ok: true } | { ok: false; reason: string } {
  if (input.sourceId === input.targetId) return { ok: false, reason: "統合元と統合先が同一です" };
  return { ok: true };
}

export function validateSplit(input: { ticketMessageIds: string[]; messageId: string }): { ok: true } | { ok: false; reason: string } {
  if (!input.ticketMessageIds.includes(input.messageId)) return { ok: false, reason: "対象メールがこのチケットに属しません" };
  if (input.ticketMessageIds.length <= 1) return { ok: false, reason: "唯一のメールは分割できません" };
  return { ok: true };
}
