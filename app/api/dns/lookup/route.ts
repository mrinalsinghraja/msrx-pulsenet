import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Use DNS-over-HTTPS (Google) — works in any serverless/edge env, no Node.js dns module needed
const DOH_URL = "https://dns.google/resolve";

const CATEGORY_MAP: Record<string, string> = {
  cloudflare: "CDN", fastly: "CDN", akamai: "CDN", amazonaws: "Cloud",
  google: "Search", github: "Cloud", microsoft: "Cloud", azure: "Cloud",
  linkedin: "Social Media", facebook: "Social Media", twitter: "Social Media",
  instagram: "Social Media", youtube: "Streaming", netflix: "Streaming",
  spotify: "Streaming", wikipedia: "Knowledge",
};

function detectCategory(hostname: string, org: string): string {
  const h = hostname.toLowerCase() + " " + org.toLowerCase();
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (h.includes(key)) return cat;
  }
  return "Unknown";
}

function countryToFlag(code: string): string {
  if (code.length !== 2) return "🌐";
  return code.toUpperCase().split("")
    .map((c: string) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")
    ?.trim().replace(/^https?:\/\//, "").split("/")[0];
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  const start = Date.now();
  try {
    // DNS-over-HTTPS via Google — reliable on all platforms
    const dohRes = await fetch(`${DOH_URL}?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { Accept: "application/dns-json" },
    });

    if (!dohRes.ok) {
      return NextResponse.json({ error: "DNS resolution failed" }, { status: 400 });
    }

    const dohData = await dohRes.json();
    const answer = dohData.Answer?.find((r: { type: number }) => r.type === 1); // A record
    if (!answer) {
      return NextResponse.json({ error: "No A record found for this domain" }, { status: 400 });
    }

    const ip = answer.data as string;
    const dnsMs = Date.now() - start;

    // Geo lookup via ipinfo.io
    let country = "—", flag = "🌐", org = "—";
    try {
      const geo = await fetch(`https://ipinfo.io/${ip}/json`);
      if (geo.ok) {
        const data = await geo.json();
        country = data.country ?? "—";
        org = data.org ?? "—";
        flag = countryToFlag(country);
      }
    } catch { /* geo optional */ }

    const category = detectCategory(domain, org);

    // Save to DB (non-blocking — don't fail the response if DB write fails)
    const id = `dns_${Date.now()}`;
    const createdAt = new Date();
    try {
      const saved = await prisma.dnsLookup.create({
        data: { domain, ip, country, flag, category, dnsMs, org },
      });
      return NextResponse.json(saved);
    } catch {
      // DB save failed — still return the lookup result
      return NextResponse.json({ id, domain, ip, country, flag, category, dnsMs, org, createdAt });
    }
  } catch {
    return NextResponse.json({ error: "DNS resolution failed" }, { status: 400 });
  }
}
