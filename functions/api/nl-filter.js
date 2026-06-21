// functions/api/nl-filter.js — POST { text, labels, projects } -> { query: string }
import { buildFilterPrompt, parseFilterQuery } from "./_ai.js";

const MODEL = "claude-opus-4-8"; // switch to "claude-haiku-4-5" to cut cost

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not_configured" }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  const text = String(body?.text || "").trim();
  if (!text) return json({ error: "missing_text" }, 400);

  const prompt = buildFilterPrompt(text, body?.labels || [], body?.projects || []);

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
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"],
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
  const out = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return json({ query: parseFilterQuery(out) });
}
