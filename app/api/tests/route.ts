import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const hours = parseInt(req.nextUrl.searchParams.get("hours") ?? "24");
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const tests = await prisma.testSession.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(tests);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const test = await prisma.testSession.create({ data: body });
  return NextResponse.json(test, { status: 201 });
}
