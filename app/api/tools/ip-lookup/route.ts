import { NextRequest, NextResponse } from "next/server";

function countryToFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  return code.toUpperCase().split("").map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join("");
}

export async function GET(req: NextRequest) {
  const ip = req.nextUrl.searchParams.get("ip")?.trim() || "";

  try {
    const url = ip ? `https://ipinfo.io/${encodeURIComponent(ip)}/json` : "https://ipinfo.io/json";
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) return NextResponse.json({ error: "IP lookup failed" }, { status: 400 });

    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message || "IP not found" }, { status: 400 });

    return NextResponse.json({
      ip: data.ip,
      hostname: data.hostname || null,
      city: data.city || null,
      region: data.region || null,
      country: data.country || null,
      flag: countryToFlag(data.country || ""),
      org: data.org || null,
      timezone: data.timezone || null,
      loc: data.loc || null,
    });
  } catch {
    return NextResponse.json({ error: "IP lookup failed" }, { status: 500 });
  }
}
