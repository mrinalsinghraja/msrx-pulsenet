import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const checks = await prisma.check.findMany({
    where: { monitorId: id },
    orderBy: { checkedAt: "desc" },
    take: 90,
  });
  return NextResponse.json(checks);
}
