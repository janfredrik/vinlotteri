import { bus, roundChannel } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const channel = roundChannel(Number(id));
  const encoder = new TextEncoder();

  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const push = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* stream already closed */
        }
      };
      push("retry: 5000\ndata: hello\n\n");

      const onChange = () => push("data: update\n\n");
      bus.on(channel, onChange);

      const keepAlive = setInterval(() => push("data: ping\n\n"), 25_000);

      cleanup = () => {
        clearInterval(keepAlive);
        bus.off(channel, onChange);
      };
    },
    cancel() {
      cleanup();
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
