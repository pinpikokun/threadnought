// 認証はポート&アダプター設計。本体はこのインターフェースだけに依存し、
// 内部アカウント/OAuth/SSO は差し替え可能なアダプターとして実装する。
export type AuthResult =
  | { kind: "ok"; operatorId: string }
  | { kind: "invalid_credentials" }
  | { kind: "inactive" };

export interface AuthProvider {
  verifyCredentials(username: string, password: string): Promise<AuthResult>;
}
