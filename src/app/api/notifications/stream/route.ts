import { getCurrentActor } from "@/lib/auth/current";
import { subscribeNotifications, isEventVisibleTo } from "@/lib/notify/bus";

export const dynamic = "force-dynamic";

// アプリ内リアルタイム通知の SSE ストリーム。窓口スコープでフィルタして配信する。
// 常駐 Node サーバー(next start / Docker)前提。イベント源(mail/fetch)と同一プロセスで動く。
export async function GET() {
  const actor = await getCurrentActor();
  if (!actor) return new Response("unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // 送信先が閉じられた等。購読を解除して以後の書き込みを止める。
          cleanup();
        }
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
      };

      send(": connected\n\n");
      unsubscribe = subscribeNotifications((event) => {
        if (!isEventVisibleTo(event, actor)) return;
        send(`event: notify\ndata: ${JSON.stringify(event)}\n\n`);
      });
      // プロキシのアイドルタイムアウト回避のコメントping。
      heartbeat = setInterval(() => send(": ping\n\n"), 25000);
    },
    cancel() {
      closed = true;
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
