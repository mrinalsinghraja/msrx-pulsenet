import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const rawIp = forwarded ? forwarded.split(",")[0].trim() : null;
  const isLocal = !rawIp || rawIp === "::1" || rawIp === "127.0.0.1" || rawIp.startsWith("192.168");
  const ip = isLocal ? "me" : rawIp;

  try {
    const res = await fetch(`https://ipinfo.io/${ip}/json`);
    const data = await res.json();
    return NextResponse.json({
      ip: data.ip,
      isp: data.org,
      city: data.city,
      region: data.region,
      country: data.country,
      timezone: data.timezone,
    });
  } catch {
    return NextResponse.json({ ip, isp: "Unknown", city: "—", region: "—", country: "—" });
  }
}
