import { EventEmitter } from "node:events";
import type { Role } from "@/generated/prisma/client";

// アプリ内リアルタイム通知の最小イベント。新着メール取り込み時に発火する。
export type NotifyEvent = {
  type: "ticket_created" | "message_appended" | "ticket_reopened";
  accountId: string;
  ticketId: string;
  caseNumber: string;
  title: string;
  at: number; // epoch ms
};

const CHANNEL = "notify";

// 単一 Node プロセス内で共有する EventEmitter。dev の HMR で作り直されないよう globalThis に載せる。
// 注: 複数インスタンス構成では各プロセスに閉じるため、将来は外部 pub/sub(Redis 等)への差し替えが必要。
const g = globalThis as unknown as { __tnNotifyEmitter?: EventEmitter };
const emitter = g.__tnNotifyEmitter ?? (g.__tnNotifyEmitter = new EventEmitter());
emitter.setMaxListeners(0); // SSE クライアント数だけリスナーが付く

export function publishNotification(event: NotifyEvent): void {
  emitter.emit(CHANNEL, event);
}

// 購読を登録し、解除関数を返す。
export function subscribeNotifications(listener: (event: NotifyEvent) => void): () => void {
  emitter.on(CHANNEL, listener);
  return () => emitter.off(CHANNEL, listener);
}

// この操作者にこのイベントを見せてよいか(窓口スコープ)。ADMIN は全窓口、他は所属窓口のみ。
export function isEventVisibleTo(
  event: NotifyEvent,
  actor: { role: Role; accountIds: string[] },
): boolean {
  return actor.role === "ADMIN" || actor.accountIds.includes(event.accountId);
}
