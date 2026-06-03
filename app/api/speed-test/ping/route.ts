import { NextResponse } from "next/server";

export async function GET() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
