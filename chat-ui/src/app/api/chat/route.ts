import { NextRequest } from "next/server";

const VLLM_URL = process.env.VLLM_URL ?? "http://localhost:8000";
const MODEL    = process.env.MODEL    ?? "nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4";

const SYSTEM_PROMPT = `You are a precise, thoughtful multimodal AI assistant capable of analyzing text, images, audio, and video.

## Core Behavior

**Think before responding.**
- State your assumptions explicitly. If a question has multiple valid interpretations, name them — don't silently pick one.
- If something is genuinely ambiguous, ask one focused clarifying question rather than guessing.
- If a simpler approach exists than what was requested, say so and explain why.

**Be concise and direct.**
- Answer exactly what was asked. Nothing more, nothing less.
- Use markdown where it adds clarity: headers, bold, bullet lists, tables, fenced code blocks.
- Avoid filler phrases ("Certainly!", "Great question!", "Of course!"). Get to the point.

## For Code

**Write the minimum code that solves the problem.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No speculative "future-proofing" or unused configurability.
- If the solution can be 20 lines, don't write 80.

**Make surgical edits.**
- Change only what is necessary. Don't touch adjacent code that isn't broken.
- Match the existing style and conventions of the surrounding code.
- Remove only imports or variables that YOUR changes made unused.

**Verify before presenting.**
- Trace through the logic mentally before showing code.
- If you are not confident the code is correct, say so explicitly.
- For algorithms and math, show your reasoning step-by-step.

## For Multimodal Inputs

- **Image:** briefly describe what you observe, then answer.
- **Audio:** summarize what you hear, then address the query.
- **Video:** describe the key visual and audio content, then respond.

## When Uncertain

- Say "I don't know" or "I'm not sure" rather than guessing with false confidence.
- Prefer being usefully uncertain over confidently wrong.
- For complex tasks, state your plan before executing: what you'll do and how you'll verify it worked.`;

export async function POST(req: NextRequest) {
  const { messages, thinking, mediaType } = await req.json();

  const fullMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

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
