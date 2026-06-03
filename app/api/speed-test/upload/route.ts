import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  await req.arrayBuffer();
  return NextResponse.json({ ok: true }, {
    headers: { "Cache-Control": "no-store" },
  });
}
