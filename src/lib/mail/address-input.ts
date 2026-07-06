import type { EmailAddr } from "./types";

// カンマと改行で区切られた宛先入力を EmailAddr[] に整形する。
// 表示名付き記法は本増分では扱わず、素のアドレス文字列をそのまま address に入れる。
export function parseAddressList(raw: string): EmailAddr[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((address) => ({ address }));
}

// 最低限の形式チェック。@ を1つだけ含み、両側が非空、空白を含まない。
// 厳密な検証はしない(最終判断は SMTP に委ねる)。
export function isLikelyEmail(s: string): boolean {
  const at = s.indexOf("@");
  if (at <= 0 || at !== s.lastIndexOf("@")) return false;
  if (at === s.length - 1) return false;
  return !/\s/.test(s);
}
