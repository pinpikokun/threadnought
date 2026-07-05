import { getSessionToken } from "./cookies";
import { resolveSession, type SessionActor } from "./session-repo";

export type AppActor = SessionActor;

// リクエストCookieからセッションを解決して現在の操作者を返す。未ログインなら null。
export async function getCurrentActor(): Promise<AppActor | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return resolveSession(token);
}
