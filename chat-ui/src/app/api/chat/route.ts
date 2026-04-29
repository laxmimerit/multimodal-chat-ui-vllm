import { NextRequest } from "next/server";

const VLLM_URL = process.env.VLLM_URL ?? "http://localhost:8000";
const MODEL    = process.env.MODEL    ?? "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4";

export async function POST(req: NextRequest) {
  const { messages, thinking, mediaType } = await req.json();

  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    stream: true,
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
