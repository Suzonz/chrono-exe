import { addSSEClient, serializeEvent, snapshotEvent } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEEPALIVE_MS = 15000;

export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(chunk));
      };

      const keepalive = setInterval(() => {
        try {
          send(": keepalive\n\n");
        } catch {
          close();
        }
      }, KEEPALIVE_MS);

      const unregister = addSSEClient(send);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
        unregister();
        try {
          controller.close();
        } catch {
          // already closed by the runtime
        }
      };
      cleanup = close;
      request.signal.addEventListener("abort", close);

      // Tell the browser how long to wait before its own native reconnect,
      // then push the current state immediately so the UI never starts empty.
      send("retry: 5000\n\n");
      send(serializeEvent(await snapshotEvent()));
    },
    cancel() {
      cleanup?.();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
