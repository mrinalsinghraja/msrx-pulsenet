import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  let url = req.nextUrl.searchParams.get("url")?.trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only http/https allowed" }, { status: 400 });
    }

    const start = Date.now();
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "PulseNet/1.0 Header Inspector" },
    });
    const ms = Date.now() - start;

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => { headers[key] = value; });

    return NextResponse.json({ url: res.url || url, status: res.status, statusText: res.statusText, ms, headers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed" }, { status: 500 });
  }
}
