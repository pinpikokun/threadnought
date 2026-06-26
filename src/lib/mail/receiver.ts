import type { ParsedEmail } from "./types";

export interface MailReceiver {
  fetchNew(): Promise<ParsedEmail[]>;
  markProcessed(uids: string[]): Promise<void>;
}
