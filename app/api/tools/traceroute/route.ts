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

// ── Globalping TCP traceroute (free API, no key, ~100 credits/hour) ──────────
// TCP mode avoids ICMP raw socket restrictions. Returns real hop data.
async function globalpingTraceroute(host: string): Promise<{ hops: Hop[]; source: "globalping" } | null> {
  try {
    // 1. Create measurement
    const createRes = await fetch("https://api.globalping.io/v1/measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "traceroute",
        target: host,
        limit: 1,
        measurementOptions: { protocol: "TCP", port: 80 },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!createRes.ok) return null;
    const { id } = await createRes.json();
    if (!id) return null;

    // 2. Poll for results (max 8s)
    for (let i = 0; i < 7; i++) {
      await new Promise((r) => setTimeout(r, 1100));
      const resultRes = await fetch(`https://api.globalping.io/v1/measurements/${id}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!resultRes.ok) continue;
      const data = await resultRes.json();
      const result = data?.results?.[0]?.result;
      if (!result || result.status === "in-progress") continue;
      if (result.status !== "finished") return null;

      // 3. Parse hops from Globalping format
      // Each hop: { resolvedAddress, resolvedHostname, timings: [{rtt: ms}] }
      const rawHops: Array<{ resolvedAddress: string | null; resolvedHostname: string | null; timings: Array<{ rtt: number }> }> = result.hops ?? [];
      const hops: Hop[] = rawHops.map((h, idx) => {
        const rtts = (h.timings ?? []).map((t) => t.rtt).filter((r) => r != null);
        const timeout = !h.resolvedAddress || rtts.length === 0;
        const avg = rtts.length ? Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length * 10) / 10 : 0;
        const best = rtts.length ? Math.min(...rtts) : 0;
        const worst = rtts.length ? Math.max(...rtts) : 0;
        return {
          hop: idx + 1,
          host: h.resolvedAddress || h.resolvedHostname || "???",
          loss: timeout ? 100 : 0,
          last: rtts.at(-1) ?? 0,
          avg, best, worst, stdev: 0,
          timeout,
        };
      });

      if (hops.length === 0) return null;
      return { hops, source: "globalping" };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("host")?.trim().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  const host = sanitize(raw);
  if (!host) return NextResponse.json({ error: "host required" }, { status: 400 });

  // ── 1. Globalping TCP traceroute (free, global probes, no rate-limit issues) ──
  const gpResult = await globalpingTraceroute(host);
  if (gpResult) {
    const last = gpResult.hops.at(-1)!;
    return NextResponse.json({ mode: "mtr", host, hops: gpResult.hops, source: gpResult.source, reachable: !last.timeout, totalMs: last.avg });
  }

  // ── 2. Try local traceroute binary (TCP mode, no root needed) ─────────────
  try {
    const { stdout } = await execAsync(`timeout 8 traceroute -T -n -m 15 -q 1 -w 1 ${host} 2>&1`, { timeout: 9000 });
    const hops = parseTraceroute(stdout);
    if (hops.length > 0) {
      const last = hops.at(-1)!;
      return NextResponse.json({ mode: "mtr", host, hops, source: "traceroute", reachable: !last.timeout, totalMs: last.avg });
    }
  } catch { /* binary not available */ }

  // ── 3. tracepath (never needs root) ───────────────────────────────────────
  try {
    const { stdout } = await execAsync(`timeout 8 tracepath -n -m 15 ${host} 2>&1`, { timeout: 9000 });
    const hops = parseTracepath(stdout);
    if (hops.length > 0) {
      const last = hops.at(-1)!;
      return NextResponse.json({ mode: "mtr", host, hops, source: "tracepath", reachable: !last.timeout, totalMs: last.avg });
    }
  } catch { /* not available */ }

  // ── 4. HackerTarget MTR API ────────────────────────────────────────────────
  try {
    const res = await fetch(`https://api.hackertarget.com/mtr/?q=${encodeURIComponent(host)}`, { signal: AbortSignal.timeout(20000) });
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
