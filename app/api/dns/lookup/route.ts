import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import dns from "node:dns/promises";

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

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim().replace(/^https?:\/\//, "").split("/")[0];
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  const start = Date.now();
  try {
    const addresses = await dns.resolve4(domain);
    const dnsMs = Date.now() - start;
    const ip = addresses[0];

    // Geo lookup via ipinfo.io (free tier)
    let country = "—", flag = "🌐", org = "—";
    try {
      const geo = await fetch(`https://ipinfo.io/${ip}/json`);
      if (geo.ok) {
        const data = await geo.json();
        country = data.country ?? "—";
        org = data.org ?? "—";
        // Country code to emoji flag
        if (country.length === 2) {
          flag = country
            .toUpperCase()
            .split("")
            .map((c: string) => String.fromCodePoint(127397 + c.charCodeAt(0)))
            .join("");
        }
      }
    } catch { /* geo failed, use defaults */ }

    const category = detectCategory(domain, org);

    const lookup = await prisma.dnsLookup.create({
      data: { domain, ip, country, flag, category, dnsMs, org },
    });

    return NextResponse.json(lookup);
  } catch {
    return NextResponse.json({ error: "DNS resolution failed" }, { status: 400 });
  }
}
