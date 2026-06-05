import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const { metric, value, unit, context } = await req.json();

  const systemPrompt = `You are PulseNet's network diagnostics AI. You explain specific network metrics to non-technical users with precision and empathy.

Reference ranges (industry standard):
- Download Speed: Excellent ≥100 Mbps, Good ≥25 Mbps, Fair ≥10 Mbps, Poor <10 Mbps
- Upload Speed: Excellent ≥50 Mbps, Good ≥10 Mbps, Fair ≥5 Mbps, Poor <5 Mbps
- Latency: Excellent ≤20 ms, Good ≤30 ms, Fair ≤60 ms, Poor >60 ms
- Jitter: Excellent ≤5 ms, Good ≤10 ms, Fair ≤20 ms, Poor >20 ms
- Packet Loss: Excellent 0%, Good <0.5%, Fair <1%, Poor ≥1%
- Network Score: Excellent ≥90, Good ≥75, Fair ≥50, Poor <50

Rules:
- Always reference the exact numeric value in your explanation
- Compare it to the reference range (e.g. "Your 36ms latency exceeds the 30ms ideal threshold")
- Give ONE specific actionable recommendation for their exact situation
- Consider the full network context if provided
- Keep plain English — no jargon without explanation
- Return ONLY valid JSON, no markdown`;

  const userPrompt = `Metric: ${metric}
Value: ${value}${unit ? " " + unit : ""}
${context ? `Full network context: ${context}` : ""}

Return JSON:
{
  "status": "Excellent" | "Good" | "Acceptable" | "Concerning" | "Critical",
  "explanation": "2-3 sentences: what this metric is, what their specific value means, and how it compares to the reference range",
  "recommendation": "1-2 sentences: specific actionable advice for THIS value — not generic advice"
}`;

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 400,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (e) {
    console.error("metric-explain error:", e);
    return NextResponse.json({ error: "AI unavailable" }, { status: 500 });
  }
}
