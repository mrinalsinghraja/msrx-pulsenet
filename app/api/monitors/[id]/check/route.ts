import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { performCheck } from "@/lib/check";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const monitor = await prisma.monitor.findUnique({ where: { id } });
  if (!monitor) return NextResponse.json({ error: "not found" }, { status: 404 });
  const result = await performCheck(id, monitor.url);
  return NextResponse.json(result);
}
