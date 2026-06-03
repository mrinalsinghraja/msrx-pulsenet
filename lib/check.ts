import { prisma } from "./prisma";

export async function performCheck(monitorId: string, url: string) {
  const start = Date.now();
  let status = "down";
  let responseMs: number | null = null;
  let statusCode: number | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "PulseNet-Monitor/1.0 (pulsenet.msrx.co.in)" },
    });
    clearTimeout(timer);
    responseMs = Date.now() - start;
    statusCode = res.status;
    status = res.status < 500 ? "up" : "down";
  } catch {
    responseMs = Date.now() - start;
  }

  const check = await prisma.check.create({
    data: { monitorId, status, responseMs, statusCode },
  });

  await prisma.check.deleteMany({
    where: {
      monitorId,
      checkedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  return { status, responseMs, statusCode, checkedAt: check.checkedAt };
}
