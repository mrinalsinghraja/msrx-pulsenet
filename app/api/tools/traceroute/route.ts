import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const DOH = "https://dns.google/resolve";

// ── Types ─────────────────────────────────────────────────────────────────────
type Hop = {
  hop: number; host: string; loss: number;
  last: number; avg: number; best: number; worst: number; stdev: number;
  timeout: boolean;
};

// ── Input sanitizer (prevent shell injection) ─────────────────────────────────
function sanitize(host: string): string {
  return host.replace(/[^a-zA-Z0-9.\-:]/g, "");
}

// ── Parser: standard traceroute format ───────────────────────────────────────
// Line formats:
//   " 1  192.168.1.1  1.234 ms  1.456 ms  1.123 ms"
//   " 3  * * *"
//   " 2  host (192.168.1.1)  1.234 ms  ..."
function parseTraceroute(text: string): Hop[] {
  const hops: Hop[] = [];
  for (const line of text.split("\n")) {
    const timeout = line.match(/^\s*(\d+)\s+\*(?:\s+\*){1,2}/);
    if (timeout) {
      hops.push({ hop: parseInt(timeout[1]), host: "???", loss: 100, last: 0, avg: 0, best: 0, worst: 0, stdev: 0, timeout: true });
      continue;
    }
    // Match IP with optional hostname
    const m = line.match(/^\s*(\d+)\s+(?:\S+ \()?(\d[\d.]+)\)?  +([\d.]+) ms\s+([\d.]+) ms(?:\s+([\d.]+) ms)?/);
    if (m) {
      const times = [parseFloat(m[3]), parseFloat(m[4]), m[5] ? parseFloat(m[5]) : parseFloat(m[4])];
      const avg = Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
      hops.push({ hop: parseInt(m[1]), host: m[2], loss: 0, last: times[2], avg, best: Math.min(...times), worst: Math.max(...times), stdev: 0, timeout: false });
    }
  }
  return hops;
}

// ── Parser: MTR report format (mtr --report) ──────────────────────────────────
function parseMTR(text: string): Hop[] {
  const hops: Hop[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(\d+)\.\|--\s+(\S+)\s+([\d.]+)%?\s+\d+\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (m) {
      const loss = parseFloat(m[3]);
      hops.push({ hop: parseInt(m[1]), host: m[2], loss, last: parseFloat(m[4]), avg: parseFloat(m[5]), best: parseFloat(m[6]), worst: parseFloat(m[7]), stdev: parseFloat(m[8]), timeout: m[2] === "???" || loss >= 100 });
    }
  }
  return hops;
}

// ── Parser: tracepath format ──────────────────────────────────────────────────
// Line format: " 1:  192.168.1.1   0.456ms"
function parseTracepath(text: string): Hop[] {
  const seen = new Map<number, Hop>();
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(\d+):\s+(\S+)\s+([\d.]+)ms/);
    if (m) {
      const hop = parseInt(m[1]);
      const host = m[2];
      const ms = parseFloat(m[3]);
      if (seen.has(hop)) {
        const h = seen.get(hop)!;
        h.best = Math.min(h.best, ms);
        h.worst = Math.max(h.worst, ms);
        h.avg = Math.round((h.avg + ms) / 2 * 10) / 10;
        h.last = ms;
      } else {
        seen.set(hop, { hop, host, loss: 0, last: ms, avg: ms, best: ms, worst: ms, stdev: 0, timeout: host === "???" });
      }
    }
    const nr = line.match(/^\s*(\d+):\s+no reply/);
    if (nr) {
      const hop = parseInt(nr[1]);
      if (!seen.has(hop)) seen.set(hop, { hop, host: "???", loss: 100, last: 0, avg: 0, best: 0, worst: 0, stdev: 0, timeout: true });
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.hop - b.hop);
}

// ── BGP / geo fallback ────────────────────────────────────────────────────────
async function networkAnalysis(host: string) {
  let ip: string | null = null;
  try {
    const d = await fetch(`${DOH}?name=${encodeURIComponent(host)}&type=A`, { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) });
    const j = await d.json();
    ip = j.Answer?.find((r: { type: number }) => r.type === 1)?.data ?? null;
  } catch { /* skip */ }
  if (!ip) return null;

  let geo: Record<string, string> = {};
  try {
    const g = await fetch(`https://ipinfo.io/${ip}/json`, { signal: AbortSignal.timeout(5000) });
    if (g.ok) geo = await g.json();
  } catch { /* skip */ }

  let bgp: { prefix?: string; asn?: number; asnName?: string } = {};
  try {
    const b = await fetch(`https://api.bgpview.io/ip/${ip}`, { signal: AbortSignal.timeout(6000) });
    if (b.ok) { const bd = await b.json(); const p = bd?.data?.prefixes?.[0]; if (p) bgp = { prefix: p.prefix, asn: p.asn?.asn, asnName: p.asn?.name }; }
  } catch { /* skip */ }

  let latencyMs: number | null = null;
  try { const s = Date.now(); await fetch(`https://${host}`, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) }); latencyMs = Date.now() - s; } catch { /* skip */ }

  function flag(c: string) { if (!c || c.length !== 2) return "🌐"; return c.toUpperCase().split("").map((x: string) => String.fromCodePoint(127397 + x.charCodeAt(0))).join(""); }
  return { mode: "analysis" as const, host, ip, hostname: geo.hostname || null, country: geo.country || null, flag: flag(geo.country || ""), city: geo.city || null, region: geo.region || null, org: geo.org || null, timezone: geo.timezone || null, loc: geo.loc || null, bgpPrefix: bgp.prefix || null, bgpAsn: bgp.asn || null, bgpAsnName: bgp.asnName || null, latencyMs };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("host")?.trim().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  const host = sanitize(raw);
  if (!host) return NextResponse.json({ error: "host required" }, { status: 400 });

  // ── 1. Try local traceroute binary (TCP mode, no root needed) ─────────────
  try {
    const { stdout } = await execAsync(
      `timeout 8 traceroute -T -n -m 15 -q 1 -w 1 ${host} 2>&1`,
      { timeout: 9000 }
    );
    const hops = parseTraceroute(stdout);
    if (hops.length > 0) {
      const last = hops.at(-1)!;
      return NextResponse.json({ mode: "mtr", host, hops, source: "traceroute", reachable: !last.timeout, totalMs: last.avg });
    }
  } catch { /* binary not available or failed */ }

  // ── 2. Try tracepath (never needs root, ships with iputils) ───────────────
  try {
    const { stdout } = await execAsync(
      `timeout 8 tracepath -n -m 15 ${host} 2>&1`,
      { timeout: 9000 }
    );
    const hops = parseTracepath(stdout);
    if (hops.length > 0) {
      const last = hops.at(-1)!;
      return NextResponse.json({ mode: "mtr", host, hops, source: "tracepath", reachable: !last.timeout, totalMs: last.avg });
    }
  } catch { /* not available */ }

  // ── 3. Try mtr --report (if installed) ────────────────────────────────────
  try {
    const { stdout } = await execAsync(
      `timeout 8 mtr --report -n -c 2 -m 15 ${host} 2>&1`,
      { timeout: 9000 }
    );
    if (stdout.includes("|--")) {
      const hops = parseMTR(stdout);
      if (hops.length > 0) {
        const last = hops.at(-1)!;
        return NextResponse.json({ mode: "mtr", host, hops, source: "mtr", reachable: !last.timeout && last.loss === 0, totalMs: last.avg });
      }
    }
  } catch { /* not available */ }

  // ── 4. HackerTarget MTR API (external, rate-limited free tier) ────────────
  try {
    const res = await fetch(`https://api.hackertarget.com/mtr/?q=${encodeURIComponent(host)}`, {
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    if (text.includes("|--")) {
      const hops = parseMTR(text);
      if (hops.length > 0) {
        const last = hops.at(-1)!;
        return NextResponse.json({ mode: "mtr", host, hops, source: "hackertarget", reachable: !last.timeout && last.loss === 0, totalMs: last.avg });
      }
    }
  } catch { /* timeout or error */ }

  // ── 5. BGP + geo analysis fallback ────────────────────────────────────────
  const analysis = await networkAnalysis(host);
  if (analysis) return NextResponse.json({ ...analysis, rateLimitFallback: true });

  return NextResponse.json({ error: "All traceroute methods failed. Try again later." }, { status: 503 });
}
