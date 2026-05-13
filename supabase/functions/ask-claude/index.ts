// Supabase Edge Function: ask-claude
// Proxies chat requests from the MJM-AI dashboard to the Anthropic API.
// Deploy: supabase functions deploy ask-claude
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import Anthropic from "npm:@anthropic-ai/sdk@^0.40.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 16000;

type IncomingFile = {
  mime_type?: string;
  data?: string; // base64-encoded
};

type RequestBody = {
  userText?: string;
  mode?: "visual" | "files" | "chat";
  files?: IncomingFile[];
};

function systemPromptFor(mode: RequestBody["mode"]): string {
  if (mode === "visual") {
    return `You are Elon, MJM-AI analyst. Build visual widgets.
CRITICAL RULES:
1. You MUST separate EVERY SINGLE distinct chart, graph, or metric with the exact delimiter "||WIDGET||". 1 Metric/Chart = 1 Sticker.
2. NO <script> tags, Chart.js, or external JS libraries allowed.
3. Draw all complex charts using ONLY pure HTML, Tailwind CSS, and inline SVG paths.
4. NEVER invent or hallucinate data; ONLY use the exact data found explicitly in the attached files.`;
  }
  if (mode === "files") {
    return `You are Elon, MJM-AI analyst. You have been provided with data files specifically filtered by the user.
CRITICAL RULE: You must ONLY analyze and extract data for the specific estates/companies present in these attached files. DO NOT invent, hallucinate, or pull external data to fill in blanks for other estates. If the user asks about estates not in these files, explicitly state that you are only viewing the currently filtered selection.
Structure your response cleanly using Markdown format.`;
  }
  return `You are Elon, MJM-AI operations chatbot. Structure your response cleanly using Markdown format.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as RequestBody;
    const userText = (body.userText ?? "").trim();
    if (!userText) {
      return new Response(JSON.stringify({ error: "userText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent: Anthropic.ContentBlockParam[] = [
      { type: "text", text: userText },
    ];

    for (const f of body.files ?? []) {
      const mime = f.mime_type || "image/jpeg";
      const data = f.data;
      if (!data) continue;

      if (mime.startsWith("image/")) {
        userContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mime as
              | "image/jpeg"
              | "image/png"
              | "image/gif"
              | "image/webp",
            data,
          },
        });
      } else if (mime === "application/pdf") {
        userContent.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data,
          },
        });
      }
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPromptFor(body.mode),
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return new Response(
      JSON.stringify({
        text,
        stop_reason: response.stop_reason,
        usage: response.usage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
