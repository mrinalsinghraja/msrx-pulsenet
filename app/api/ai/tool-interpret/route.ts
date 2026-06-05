import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 503 });
  }

  const { toolName, toolId, result } = await req.json();

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const systemPrompt = `You are PulseNet's network diagnostics AI. A user ran a network tool and got results. Interpret those results clearly for a non-technical user.

Rules:
- Be specific — reference actual values from the result data
- Keep plain English — explain what each finding means in real-world terms
- Flag any issues, risks, or anomalies with a ⚠ prefix
- Flag positives with a ✓ prefix
- Recommendations should be actionable for their specific result
- Do NOT just describe what the tool does — interpret the SPECIFIC data returned
- Return ONLY valid JSON, no markdown`;

  const userPrompt = `Tool: ${toolName} (${toolId})
Result data: ${JSON.stringify(result, null, 2).slice(0, 3000)}

Return JSON:
{
  "summary": "2-3 sentences interpreting what this specific result means for the user",
  "findings": ["finding 1 with ✓ or ⚠ prefix", "finding 2", "finding 3"],
  "recommendations": ["actionable recommendation based on this result"]
}

findings: 2-4 items. recommendations: 1-3 items.`;

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 500,
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
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
