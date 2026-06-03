import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const { metric, value, unit, context } = await req.json();

  const contextStr = context
    ? `\nOther current metrics: ${context}`
    : "";

  const prompt = `You are a network diagnostics expert. Analyze this network metric for a non-technical user.

Metric: ${metric}
Current value: ${value}${unit ? " " + unit : ""}${contextStr}

Return ONLY valid JSON, no markdown, no extra text:
{
  "status": "Excellent" | "Good" | "Acceptable" | "Concerning" | "Critical",
  "explanation": "2-3 sentences: what this metric is and what the current value means in plain language",
  "recommendation": "1-2 sentences: specific actionable advice based on this value"
}`;

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const match = text.match(/\{[\s\S]*\}/);
    const data = match ? JSON.parse(match[0]) : { status: "Unknown", explanation: text, recommendation: "" };
    return NextResponse.json(data);
  } catch (e) {
    console.error("metric-explain error:", e);
    return NextResponse.json({ error: "AI unavailable" }, { status: 500 });
  }
}
