import { NextRequest } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY not set" }), { status: 503 });
  }

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const { messages, context } = await req.json();

  const systemPrompt = `You are PulseNet AI Copilot, an expert network diagnostics assistant built into the PulseNet web app by MSRX.

${context ? `Current network data:\n${JSON.stringify(context, null, 2)}` : "No test data available yet — ask the user to run a speed test."}

You help users understand their network performance, diagnose issues, and suggest optimizations. Be concise, technical, and actionable. Use markdown for formatting when helpful.`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 512,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        });

        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
