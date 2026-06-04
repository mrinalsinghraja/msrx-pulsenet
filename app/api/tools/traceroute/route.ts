import { NextRequest, NextResponse } from "next/server";

const DOH = "https://dns.google/resolve";

// ── MTR parser ────────────────────────────────────────────────────────────────
type Hop = { hop: number; host: string; loss: number; last: number; avg: number; best: number; worst: number; stdev: number; timeout: boolean };

function parseMTR(text: string): Hop[] {
  const hops: Hop[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(\d+)\.\|--\s+(\S+)\s+([\d.]+)%\s+\d+\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (m) {
      const host = m[2];
      hops.push({ hop: parseInt(m[1]), host, loss: parseFloat(m[3]), last: parseFloat(m[4]), avg: parseFloat(m[5]), best: parseFloat(m[6]), worst: parseFloat(m[7]), stdev: parseFloat(m[8]), timeout: host === "???" || parseFloat(m[3]) >= 100 });
    }
  }
  return hops;
}

// ── BGP / geo fallback when HackerTarget is rate-limited ─────────────────────
async function networkAnalysis(host: string) {
  // 1. Resolve domain to IP
  let ip: string | null = null;
  try {
    const dohRes = await fetch(`${DOH}?name=${encodeURIComponent(host)}&type=A`, { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) });
    const doh = await dohRes.json();
    ip = doh.Answer?.find((r: { type: number }) => r.type === 1)?.data ?? null;
  } catch { /* skip */ }

  if (!ip) return null;

  // 2. IP geolocation + ASN
  let geo: Record<string, string> = {};
  try {
    const geoRes = await fetch(`https://ipinfo.io/${ip}/json`, { signal: AbortSignal.timeout(5000) });
    if (geoRes.ok) geo = await geoRes.json();
  } catch { /* skip */ }

  // 3. BGP prefix info (free API, no key required)
  let bgp: { prefix?: string; asn?: number; asnName?: string; announced?: boolean } = {};
  try {
    const bgpRes = await fetch(`https://api.bgpview.io/ip/${ip}`, { signal: AbortSignal.timeout(6000) });
    if (bgpRes.ok) {
      const bgpData = await bgpRes.json();
      const prefix = bgpData?.data?.prefixes?.[0];
      if (prefix) bgp = { prefix: prefix.prefix, asn: prefix.asn?.asn, asnName: prefix.asn?.name, announced: true };
    }
  } catch { /* skip */ }

  // 4. Quick ping (HEAD request for latency)
  let latencyMs: number | null = null;
  try {
    const start = Date.now();
    await fetch(`https://${host}`, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) });
    latencyMs = Date.now() - start;
  } catch { /* skip */ }

  function countryToFlag(code: string) {
    if (!code || code.length !== 2) return "🌐";
    return code.toUpperCase().split("").map((c: string) => String.fromCodePoint(127397 + c.charCodeAt(0))).join("");
  }

  return {
    mode: "analysis" as const,
    host,
    ip,
    hostname: geo.hostname || null,
    country: geo.country || null,
    flag: countryToFlag(geo.country || ""),
    city: geo.city || null,
    region: geo.region || null,
    org: geo.org || null,
    timezone: geo.timezone || null,
    loc: geo.loc || null,
    bgpPrefix: bgp.prefix || null,
    bgpAsn: bgp.asn || null,
    bgpAsnName: bgp.asnName || null,
    latencyMs,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host")?.trim().replace(/^https?:\/\//, "").split("/")[0];
  if (!host) return NextResponse.json({ error: "host required" }, { status: 400 });

  // Try HackerTarget MTR first
  try {
    const res = await fetch(`https://api.hackertarget.com/mtr/?q=${encodeURIComponent(host)}`, {
      signal: AbortSignal.timeout(30000),
      headers: { "User-Agent": "PulseNet/1.0" },
    });
    const text = await res.text();

    if (text.includes("|--")) {
      // MTR succeeded
      const hops = parseMTR(text);
      if (hops.length > 0) {
        return NextResponse.json({ mode: "mtr", host, hops, reachable: hops.at(-1)?.loss === 0, totalMs: hops.at(-1)?.avg ?? 0 });
      }
    }
    // Rate limited or bad response — fall through to analysis
  } catch { /* timeout or network error — fall through */ }

  // Fallback: BGP + geo analysis
  const analysis = await networkAnalysis(host);
  if (analysis) return NextResponse.json(analysis);

  return NextResponse.json({ error: "Traceroute unavailable. HackerTarget free tier rate-limited. Try again in a few hours." }, { status: 503 });
}
