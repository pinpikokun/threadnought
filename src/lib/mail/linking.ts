import type { ParsedEmail, IngestRepository } from "./types";
import { parseCaseNumber } from "./subject-token";

type LinkRepo = Pick<IngestRepository, "ticketIdByMessageIds" | "ticketIdByCaseNumber">;

export async function findParentTicketId(email: ParsedEmail, repo: LinkRepo): Promise<string | null> {
  const refIds = [email.inReplyTo, ...email.references].filter(Boolean) as string[];
  if (refIds.length) {
    const byRef = await repo.ticketIdByMessageIds(refIds);
    if (byRef) return byRef;
  }
  const cn = parseCaseNumber(email.subject);
  if (cn) {
    const byToken = await repo.ticketIdByCaseNumber(cn);
    if (byToken) return byToken;
  }
  return null; // 件名テキスト一致だけでは紐づけない
}
