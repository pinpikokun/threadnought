// PREFIX-000123 形式（接頭辞は英大文字/数字1〜10字、番号は6桁以上）
const CASE_RE = /\b([A-Z0-9]{1,10}-\d{6,})\b/;

export function parseCaseNumber(subject: string): string | null {
  const m = subject.match(CASE_RE);
  return m ? m[1] : null;
}
