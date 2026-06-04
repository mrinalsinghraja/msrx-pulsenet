import { NextRequest, NextResponse } from "next/server";
import * as net from "net";

const ALLOWED_PORTS: Record<number, string> = {
  21: "FTP", 22: "SSH", 25: "SMTP", 53: "DNS", 80: "HTTP",
  110: "POP3", 143: "IMAP", 443: "HTTPS", 465: "SMTPS",
  587: "SMTP Alt", 993: "IMAPS", 995: "POP3S",
  3306: "MySQL", 5432: "PostgreSQL", 6379: "Redis",
  8080: "HTTP Alt", 8443: "HTTPS Alt", 27017: "MongoDB",
};

function tcpCheck(host: string, port: number): Promise<{ open: boolean; ms: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(6000);

    socket.on("connect", () => { socket.destroy(); resolve({ open: true, ms: Date.now() - start }); });
    socket.on("timeout", () => { socket.destroy(); resolve({ open: false, ms: 6000 }); });
    socket.on("error", () => { resolve({ open: false, ms: Date.now() - start }); });

    socket.connect(port, host);
  });
}

export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host")?.trim()
    .replace(/^https?:\/\//, "").split("/")[0];
  const port = parseInt(req.nextUrl.searchParams.get("port") || "");

  if (!host) return NextResponse.json({ error: "host required" }, { status: 400 });
  if (!ALLOWED_PORTS[port]) {
    return NextResponse.json({ error: `Allowed ports: ${Object.keys(ALLOWED_PORTS).join(", ")}` }, { status: 400 });
  }

  try {
    const result = await tcpCheck(host, port);
    return NextResponse.json({ host, port, service: ALLOWED_PORTS[port], ...result });
  } catch {
    return NextResponse.json({ error: "Port check failed" }, { status: 500 });
  }
}
