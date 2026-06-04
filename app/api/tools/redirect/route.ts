import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  let url = req.nextUrl.searchParams.get("url")?.trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const hops: Array<{ url: string; status: number; ms: number; location: string | null }> = [];
  let current = url;

  try {
    for (let i = 0; i < 12; i++) {
      const start = Date.now();
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "PulseNet/1.0 Redirect Tracer" },
      });
      const ms = Date.now() - start;
      const location = res.headers.get("location");

      hops.push({ url: current, status: res.status, ms, location });

      if (res.status >= 300 && res.status < 400 && location) {
        current = /^https?:\/\//i.test(location) ? location : new URL(location, current).href;
      } else {
        break;
      }
    }

    return NextResponse.json({ hops, finalUrl: current, totalHops: hops.length });
  } catch (e) {
    if (hops.length > 0) return NextResponse.json({ hops, finalUrl: current, totalHops: hops.length });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Trace failed" }, { status: 500 });
  }
}
