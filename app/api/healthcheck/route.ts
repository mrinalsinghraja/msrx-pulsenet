import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    tursoUrl: process.env.TURSO_DATABASE_URL ? "SET ✓" : "MISSING ✗",
    tursoToken: process.env.TURSO_AUTH_TOKEN ? "SET ✓" : "MISSING ✗",
    groqKey: process.env.GROQ_API_KEY ? "SET ✓" : "MISSING ✗",
    databaseUrl: process.env.DATABASE_URL ?? "not set",
    nodeEnv: process.env.NODE_ENV,
  });
}
