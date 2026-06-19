// functions/api/events.js

async function getMaxUpdatedAt(db) {
  try {
    const { results } = await db.prepare(`
      SELECT MAX(val) as max_val FROM (
        SELECT MAX(updated_at) AS val FROM tasks
        UNION ALL
        SELECT MAX(updated_at) AS val FROM projects
        UNION ALL
        SELECT MAX(updated_at) AS val FROM labels
        UNION ALL
        SELECT MAX(updated_at) AS val FROM sections
      )
    `).all();
    return results?.[0]?.max_val || 0;
  } catch (err) {
    console.error("Failed to query max updated_at", err);
    return 0;
  }
}

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) {
    return new Response('D1 binding "DB" not configured', { status: 500 });
  }

  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      let lastMax = await getMaxUpdatedAt(db);
      
      // Send initial connected message
      try {
        controller.enqueue(new TextEncoder().encode(`data: {"type":"connected","lastMax":${lastMax}}\n\n`));
      } catch (e) {
        closed = true;
      }

      const poll = async () => {
        if (closed) return;
        try {
          const currentMax = await getMaxUpdatedAt(db);
          if (currentMax !== lastMax) {
            lastMax = currentMax;
            controller.enqueue(new TextEncoder().encode(`data: {"type":"api-changed"}\n\n`));
          } else {
            // Keep alive
            controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
          }
        } catch (err) {
          // If enqueue fails, stop the loop
          closed = true;
        }
      };

      // Poll loop
      (async function run() {
        while (!closed) {
          await new Promise(r => setTimeout(r, 2000));
          if (closed) break;
          await poll();
        }
      })();
    },
    cancel() {
      closed = true;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
    }
  });
}
