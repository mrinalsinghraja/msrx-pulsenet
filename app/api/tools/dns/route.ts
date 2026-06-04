import { NextRequest, NextResponse } from "next/server";

const DOH = "https://dns.google/resolve";

const TYPE_NAMES: Record<number, string> = {
  1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 12: "PTR",
  15: "MX", 16: "TXT", 28: "AAAA", 33: "SRV", 257: "CAA",
};

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim()
    .replace(/^https?:\/\//, "").split("/")[0];
  const type = (req.nextUrl.searchParams.get("type") || "A").toUpperCase();

  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  try {
    const res = await fetch(`${DOH}?name=${encodeURIComponent(domain)}&type=${type}`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error("DoH request failed");

    const data = await res.json();
    const answer = (data.Answer || []).map((r: { name: string; type: number; TTL: number; data: string }) => ({
      name: r.name,
      type: TYPE_NAMES[r.type] || String(r.type),
      ttl: r.TTL,
      value: r.data,
    }));

    return NextResponse.json({
      domain,
      type,
      status: data.Status,
      answer,
      authority: data.Authority || [],
    });
  } catch {
    return NextResponse.json({ error: "DNS query failed" }, { status: 500 });
  }
}
