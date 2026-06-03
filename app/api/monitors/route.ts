import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const monitors = await prisma.monitor.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      checks: {
        orderBy: { checkedAt: "desc" },
        take: 30,
      },
    },
  });

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const withStats = await Promise.all(
    monitors.map(async (m) => {
      const total = await prisma.check.count({
        where: { monitorId: m.id, checkedAt: { gte: since24h } },
      });
      const up = await prisma.check.count({
        where: { monitorId: m.id, status: "up", checkedAt: { gte: since24h } },
      });
      const latest = m.checks[0] ?? null;
      return {
        id: m.id,
        name: m.name,
        url: m.url,
        interval: m.interval,
        createdAt: m.createdAt,
        status: latest?.status ?? "pending",
        responseMs: latest?.responseMs ?? null,
        statusCode: latest?.statusCode ?? null,
        checkedAt: latest?.checkedAt ?? null,
        uptime: total > 0 ? Math.round((up / total) * 1000) / 10 : null,
        history: m.checks.map((c) => ({
          id: c.id,
          status: c.status,
          responseMs: c.responseMs,
          statusCode: c.statusCode,
          checkedAt: c.checkedAt,
        })),
      };
    })
  );

  return NextResponse.json(withStats);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, url, interval = 5 } = body;

  if (!name || !url) {
    return NextResponse.json({ error: "name and url required" }, { status: 400 });
  }

  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  const monitor = await prisma.monitor.create({
    data: { name, url: normalizedUrl, interval },
  });

  return NextResponse.json(monitor, { status: 201 });
}
