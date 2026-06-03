import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const { download, upload, latency, jitter, packetLoss, score } = await req.json();

  const prompt = `You are a network diagnostics expert. Analyze these network metrics and provide actionable insights.

Metrics:
- Download: ${download?.toFixed(1) ?? "N/A"} Mbps
- Upload: ${upload?.toFixed(1) ?? "N/A"} Mbps
- Latency: ${latency?.toFixed(1) ?? "N/A"} ms
- Jitter: ${jitter?.toFixed(1) ?? "N/A"} ms
- Packet Loss: ${packetLoss?.toFixed(1) ?? "N/A"}%
- Health Score: ${score ?? "N/A"}/100

Return a JSON array of 2-4 insight objects. Each object:
{
  "severity": "low" | "medium" | "high" | "critical",
  "category": "Performance" | "Stability" | "Latency" | "Speed" | "Reliability",
  "title": "Short title (max 6 words)",
  "description": "1-2 sentence explanation of what the metric means and why it matters.",
  "impact": "One sentence describing real-world impact.",
  "recommendation": "One concrete actionable fix."
}

Only return the JSON array, no markdown, no extra text.`;

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices[0]?.message?.content ?? "[]";
    // Extract JSON array even if model adds extra text
    const match = text.match(/\[[\s\S]*\]/);
    const insights = match ? JSON.parse(match[0]) : [];
    return NextResponse.json({ insights });
  } catch (e) {
    console.error("AI insights error:", e);
    return NextResponse.json({ insights: [] }, { status: 500 });
  }
}
