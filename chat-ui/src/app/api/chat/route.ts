import { NextRequest } from "next/server";

const VLLM_URL = process.env.VLLM_URL ?? "http://localhost:8000";
const MODEL    = process.env.MODEL    ?? "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4";

const DEFAULT_SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ?? `You are a helpful, precise, and intelligent multimodal AI assistant.

**Response style:**
- Be concise yet complete. Use markdown: headers, bold, bullet lists, numbered lists, and tables where they add clarity.
- For code: always use fenced code blocks with the correct language tag. Briefly explain what the code does and why key decisions were made.
- Keep answers focused. For complex topics, break them into clearly labeled sections.

**For multimodal inputs:**
- Images: briefly describe what you observe, then answer the question.
- Audio: summarize the content you hear, then address the query.
- Video: describe the key visual and audio events, then respond.

**Accuracy:**
- Reason step-by-step for math, logic, and code problems.
- If you are uncertain about something, say so clearly rather than guessing.
- Double-check calculations and code for correctness before responding.`;

export async function POST(req: NextRequest) {
  const { messages, thinking, mediaType, systemPrompt } = await req.json();

  const sysContent = (systemPrompt as string | undefined)?.trim() || DEFAULT_SYSTEM_PROMPT;
  const fullMessages = [{ role: "system", content: sysContent }, ...messages];

  const body: Record<string, unknown> = {
    model: MODEL,
    messages: fullMessages,
    stream: true,
    stream_options: { include_usage: true },
    temperature: thinking ? 0.6 : 0.2,
    max_tokens:  thinking ? 20480 : 2048,
    chat_template_kwargs: { enable_thinking: thinking },
  };

  if (thinking) {
    body.top_p = 0.95;
    body.thinking_token_budget = 16384 + 1024;
    (body.chat_template_kwargs as Record<string, unknown>).reasoning_budget = 16384;
  } else {
    body.top_k = 1;
  }

  if (mediaType === "video") {
    body.mm_processor_kwargs = { use_audio_in_video: false };
  }
  if (mediaType === "video+audio") {
    body.mm_processor_kwargs = { use_audio_in_video: true };
  }

  const upstream = await fetch(`${VLLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer unused" },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: err }), { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
