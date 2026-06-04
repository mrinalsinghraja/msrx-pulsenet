import { NextRequest, NextResponse } from "next/server";

const RESOLVERS = [
  { name: "Google", url: "https://dns.google/resolve", flag: "🔵" },
  { name: "Cloudflare", url: "https://cloudflare-dns.com/dns-query", flag: "🟠" },
  { name: "Quad9", url: "https://dns.quad9.net/dns-query", flag: "🟣" },
  { name: "AdGuard", url: "https://dns.adguard-dns.com/resolve", flag: "🟢" },
];

async function queryResolver(resolver: typeof RESOLVERS[0], name: string, type: string) {
  const start = Date.now();
  try {
    const res = await fetch(`${resolver.url}?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    const ms = Date.now() - start;
    const answers = (data.Answer || []).map((r: { data: string; TTL: number }) => ({
      value: r.data.replace(/"/g, ""),
      ttl: r.TTL,
    }));
    return { ...resolver, ms, status: data.Status, answers, error: null };
  } catch (e) {
    return { ...resolver, ms: Date.now() - start, status: -1, answers: [], error: String(e) };
  }
}

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim()
    .replace(/^https?:\/\//, "").split("/")[0];
  const type = (req.nextUrl.searchParams.get("type") || "A").toUpperCase();

  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  const results = await Promise.all(RESOLVERS.map((r) => queryResolver(r, domain, type)));

  // Check if all resolvers agree on the same answer set
  const answerSets = results.map((r) => r.answers.map((a: { value: string }) => a.value).sort().join(","));
  const unique = new Set(answerSets.filter((s) => s.length > 0));
  const propagated = unique.size <= 1;
  const consistent = results.every((r) => r.answers.length > 0);

  return NextResponse.json({
    domain,
    type,
    propagated,
    consistent,
    resolvers: results,
  });
}
