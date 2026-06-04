import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  let host = req.nextUrl.searchParams.get("host")?.trim();
  if (!host) return NextResponse.json({ error: "host required" }, { status: 400 });

  if (!/^https?:\/\//i.test(host)) host = "https://" + host;

  let parsedHost: string;
  try {
    parsedHost = new URL(host).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid host" }, { status: 400 });
  }

  const start = Date.now();
  try {
    const res = await fetch(host, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "PulseNet/1.0 Ping" },
    });
    const ms = Date.now() - start;

    return NextResponse.json({ host: parsedHost, reachable: true, status: res.status, ms });
  } catch {
    const ms = Date.now() - start;
    return NextResponse.json({ host: parsedHost, reachable: false, status: null, ms });
  }
}
