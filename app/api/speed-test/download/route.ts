import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const size = Math.min(
    parseInt(req.nextUrl.searchParams.get("size") ?? "10000000"),
    50_000_000
  );
  const buf = Buffer.alloc(size, 0);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Cache-Control": "no-store",
    },
  });
}
