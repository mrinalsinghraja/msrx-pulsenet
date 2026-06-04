import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL ?? "";

  let dbTest: string;
  try {
    const count = await prisma.testSession.count();
    dbTest = `OK — ${count} test sessions`;
  } catch (e) {
    dbTest = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    tursoUrlPrefix: tursoUrl ? tursoUrl.slice(0, 15) + "..." : "MISSING",
    tursoUrlLength: tursoUrl.length,
    tursoToken: process.env.TURSO_AUTH_TOKEN ? `SET (${process.env.TURSO_AUTH_TOKEN.length} chars)` : "MISSING ✗",
    databaseUrl: process.env.DATABASE_URL ?? "not set",
    nodeEnv: process.env.NODE_ENV,
    dbTest,
  });
}
