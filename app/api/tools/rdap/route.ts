import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim()
    .replace(/^https?:\/\//, "").split("/")[0].toLowerCase();

  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return NextResponse.json({ error: "Domain not found or RDAP unavailable" }, { status: 404 });

    const data = await res.json();

    const events: Record<string, string> = {};
    for (const ev of data.events || []) {
      events[ev.eventAction] = ev.eventDate;
    }

    const nameservers: string[] = (data.nameservers || []).map(
      (ns: { ldhName: string }) => ns.ldhName?.toLowerCase()
    ).filter(Boolean);

    let registrar = "Unknown";
    for (const entity of data.entities || []) {
      if ((entity.roles || []).includes("registrar")) {
        const vcard = entity.vcardArray?.[1];
        for (const field of vcard || []) {
          if (field[0] === "fn" && field[3]) { registrar = field[3]; break; }
        }
        if (registrar !== "Unknown") break;
      }
    }

    return NextResponse.json({
      domain: data.ldhName || domain,
      registrar,
      registered: events["registration"] || null,
      expires: events["expiration"] || null,
      updated: events["last changed"] || null,
      nameservers,
      status: (data.status || []).slice(0, 6),
    });
  } catch {
    return NextResponse.json({ error: "RDAP lookup failed" }, { status: 500 });
  }
}
