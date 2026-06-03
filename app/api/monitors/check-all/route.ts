import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { performCheck } from "@/lib/check";

async function checkDueMonitors() {
  const monitors = await prisma.monitor.findMany({
    include: {
      checks: { orderBy: { checkedAt: "desc" }, take: 1 },
    },
  });

  const now = Date.now();
  const results: { id: string; name: string; status: string }[] = [];

  for (const monitor of monitors) {
    const lastCheck = monitor.checks[0];
    const lastCheckTime = lastCheck ? new Date(lastCheck.checkedAt).getTime() : 0;
    const intervalMs = monitor.interval * 60 * 1000;

    if (now - lastCheckTime >= intervalMs) {
      const result = await performCheck(monitor.id, monitor.url);
      results.push({ id: monitor.id, name: monitor.name, status: result.status });
    }
  }

  return { checked: results.length, results };
}

// GET — called by Vercel Cron
export async function GET() {
  const data = await checkDueMonitors();
  return NextResponse.json(data);
}

// POST — called manually from dashboard
export async function POST() {
  const data = await checkDueMonitors();
  return NextResponse.json(data);
}
