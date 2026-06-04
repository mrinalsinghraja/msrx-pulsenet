import { NextResponse } from "next/server";

export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL ?? "";
  return NextResponse.json({
    tursoUrlPrefix: tursoUrl ? tursoUrl.slice(0, 12) + "..." : "MISSING",
    tursoUrlLength: tursoUrl.length,
    tursoToken: process.env.TURSO_AUTH_TOKEN ? `SET (${process.env.TURSO_AUTH_TOKEN.length} chars)` : "MISSING ✗",
    groqKey: process.env.GROQ_API_KEY ? "SET ✓" : "MISSING ✗",
    databaseUrl: process.env.DATABASE_URL ?? "not set",
    nodeEnv: process.env.NODE_ENV,
  });
}
