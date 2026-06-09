import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }

  const { download, upload, latency, jitter, packetLoss, score } = await req.json();

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const systemPrompt = `You are a network diagnostics expert for PulseNet. Given speed test metrics, return a concise JSON analysis.

IMPORTANT — use ONLY these reference thresholds when evaluating each metric. Do NOT apply your own benchmarks:
- Download:     Excellent ≥100 Mbps | Good ≥25 Mbps | Fair ≥10 Mbps | Poor <10 Mbps
- Upload:       Excellent ≥50 Mbps  | Good ≥10 Mbps | Fair ≥5 Mbps  | Poor <5 Mbps
- Latency:      Excellent ≤20 ms    | Good ≤30 ms   | Fair ≤60 ms   | Poor >60 ms
- Jitter:       Excellent ≤5 ms     | Good ≤10 ms   | Fair ≤20 ms   | Poor >20 ms
- Packet Loss:  Excellent 0%        | Good <0.5%    | Fair <1%      | Poor ≥1%
- Score:        Excellent ≥90       | Good ≥75      | Fair ≥50      | Poor <50

When a metric falls in "Good" or "Excellent" range, describe it positively — never use words like "moderate", "average", "elevated", or "concerning" for those values.
Only flag a metric negatively if it is Fair or Poor by the thresholds above.

Return ONLY valid JSON with exactly this structure — no extra keys, no markdown:
{
  "summary": "2-3 sentences explaining what these scores mean in plain English, referencing the actual numbers with their correct status (Excellent/Good/Fair/Poor), and the likely reason the connection is performing this way",
  "impacts": ["short impact 1", "short impact 2", "short impact 3"],
  "recommendations": ["actionable tip 1", "actionable tip 2", "actionable tip 3"]
}

Impacts should be real-world consequences only for metrics that are Fair or Poor. If all metrics are Good/Excellent, list positive impacts (fast streaming, low-lag gaming, crystal-clear video). Keep each under 8 words.
Recommendations should address actual weak metrics. If everything is Good/Excellent, give optimisation tips — not fixes.`;

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
