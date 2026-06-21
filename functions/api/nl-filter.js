// functions/api/nl-filter.js — POST { text, labels, projects } -> { query: string }
// Uses Cloudflare Workers AI (env.AI binding) — free within the daily Neuron allowance.
import { buildFilterPrompt, parseFilterQuery, aiResponseToText } from "./_ai.js";

// Cost/quality lever: bigger free model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast".
const MODEL = "@cf/meta/llama-3.1-8b-instruct";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ error: "not_configured" }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  const text = String(body?.text || "").trim();
  if (!text) return json({ error: "missing_text" }, 400);

  const prompt = buildFilterPrompt(text, body?.labels || [], body?.projects || []);

  let out;
  try {
    out = await env.AI.run(MODEL, {
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
    });
  } catch (e) {
    return json({ error: "upstream", detail: String(e).slice(0, 300) }, 502);
  }

  return json({ query: parseFilterQuery(aiResponseToText(out)) });
}
