import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }

  const { download, upload, latency, jitter, packetLoss, score } = await req.json();

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const systemPrompt = `You are a network diagnostics expert for PulseNet. Given speed test metrics, return a concise JSON analysis.
Return ONLY valid JSON with exactly this structure — no extra keys, no markdown:
{
  "summary": "2-3 sentences explaining what these scores mean in plain English, referencing the actual numbers, and the likely reason the connection is performing this way",
  "impacts": ["short impact 1", "short impact 2", "short impact 3"],
  "recommendations": ["actionable tip 1", "actionable tip 2", "actionable tip 3"]
}

Impacts should be real-world consequences (e.g. video calls may drop, gaming lag, audio breaking). Keep each under 8 words.
Recommendations should be specific and actionable. No generic advice like 'restart your router' unless it genuinely fits.`;

  const userMsg = `Speed test results:
Download: ${download} Mbps
Upload: ${upload} Mbps
Latency: ${latency} ms
Jitter: ${jitter} ms
Packet Loss: ${packetLoss}%
Network Score: ${score}/100`;

  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 512,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(content);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
