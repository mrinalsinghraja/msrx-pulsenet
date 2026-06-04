import { NextRequest, NextResponse } from "next/server";

type Hop = {
  hop: number;
  host: string;
  loss: number;
  last: number;
  avg: number;
  best: number;
  worst: number;
  stdev: number;
  timeout: boolean;
};

function parseMTR(text: string): Hop[] {
  const hops: Hop[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(
      /^\s*(\d+)\.\|--\s+(\S+)\s+([\d.]+)%\s+\d+\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/
    );
    if (m) {
      const host = m[2];
      hops.push({
        hop: parseInt(m[1]),
        host,
        loss: parseFloat(m[3]),
        last: parseFloat(m[4]),
        avg: parseFloat(m[5]),
        best: parseFloat(m[6]),
        worst: parseFloat(m[7]),
        stdev: parseFloat(m[8]),
        timeout: host === "???" || parseFloat(m[3]) >= 100,
      });
    }
  }
  return hops;
}

export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host")?.trim()
    .replace(/^https?:\/\//, "").split("/")[0];

  if (!host) return NextResponse.json({ error: "host required" }, { status: 400 });

  try {
    const res = await fetch(`https://api.hackertarget.com/mtr/?q=${encodeURIComponent(host)}`, {
      signal: AbortSignal.timeout(30000),
      headers: { "User-Agent": "PulseNet/1.0 Traceroute" },
    });

    const text = await res.text();

    if (text.includes("error") || text.includes("API count") || !text.includes("|--")) {
      return NextResponse.json({ error: text.trim() || "Traceroute failed — HackerTarget may be rate-limited" }, { status: 503 });
    }

    const hops = parseMTR(text);
    if (!hops.length) return NextResponse.json({ error: "No hops parsed — check host" }, { status: 400 });

    const reachable = hops.at(-1)?.loss === 0;
    const totalMs = hops.at(-1)?.avg ?? 0;

    return NextResponse.json({ host, hops, reachable, totalMs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Traceroute failed" }, { status: 500 });
  }
}
