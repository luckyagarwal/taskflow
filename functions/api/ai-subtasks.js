// functions/api/ai-subtasks.js — POST { title, note } -> { subtasks: string[] }
import { buildSubtaskPrompt, parseSubtasks } from "./_ai.js";

// Cost/latency lever: switch to "claude-haiku-4-5" to reduce cost.
const MODEL = "claude-opus-4-8";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not_configured" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const title = String(body?.title || "").trim();
  if (!title) return json({ error: "missing_title" }, 400);

  const prompt = buildSubtaskPrompt(title, body?.note);

  let resp;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { subtasks: { type: "array", items: { type: "string" } } },
              required: ["subtasks"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
  } catch (e) {
    return json({ error: "network", detail: String(e).slice(0, 200) }, 502);
  }

  if (!resp.ok) {
    const detail = (await resp.text()).slice(0, 300);
    return json({ error: "upstream", status: resp.status, detail }, 502);
  }

  const data = await resp.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return json({ subtasks: parseSubtasks(text) });
}
