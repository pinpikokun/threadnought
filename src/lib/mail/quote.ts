import type { EmailAddr } from "./types";

export type QuoteSource = {
  from: EmailAddr;
  date: Date;
  text?: string;
};

// 返信本文の末尾に付ける引用ブロックを生成する。
// 例: "On 2026-06-26 10:05 UTC, 山田 <yamada@example.com> wrote:\n> 元本文..."
export function buildQuoteText(src: QuoteSource): string {
  const who = src.from.name ? `${src.from.name} <${src.from.address}>` : src.from.address;
  const header = `On ${formatQuoteDate(src.date)}, ${who} wrote:`;
  const body = (src.text ?? "").split("\n").map((line) => `> ${line}`).join("\n");
  return `${header}\n${body}`;
}

// ロケール非依存で決定的な UTC 表記（テストが安定する）
function formatQuoteDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
