import type { ParsedEmail, IngestRepository, IngestResult } from "./types";
import type { MailReceiver } from "./receiver";
import { findParentTicketId } from "./linking";

export async function ingestEmail(
  email: ParsedEmail,
  account: { accountId: string; prefix: string },
  repo: IngestRepository,
): Promise<IngestResult> {
  // 1. 重複排除（Message-ID）
  if (await repo.findTicketIdByMessageId(email.messageId)) {
    return { kind: "skipped_duplicate", messageId: email.messageId };
  }
  // 2. 親特定
  const parentId = await findParentTicketId(email, repo);
  if (parentId) {
    const { reopened } = await repo.appendInbound({ ticketId: parentId, email });
    return { kind: "appended", ticketId: parentId, reopened };
  }
  // 3. 新規チケット
  const caseNumber = await repo.nextCaseNumber(account.prefix);
  const { ticketId } = await repo.createTicketWithInbound({ accountId: account.accountId, caseNumber, email });
  return { kind: "created", ticketId, caseNumber };
}

export async function ingestNew(
  receiver: MailReceiver,
  account: { accountId: string; prefix: string },
  repo: IngestRepository,
): Promise<IngestResult[]> {
  const emails = await receiver.fetchNew();
  const results: IngestResult[] = [];
  for (const email of emails) {
    results.push(await ingestEmail(email, account, repo));
  }
  await receiver.markProcessed(emails.map((e) => e.uid));
  return results;
}
