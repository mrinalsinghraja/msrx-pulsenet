import { NextRequest, NextResponse } from "next/server";
import * as tls from "tls";

function fetchCert(domain: string): Promise<tls.PeerCertificate> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(443, domain, { servername: domain, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate(true);
      socket.destroy();
      if (!cert || !cert.valid_to) reject(new Error("No certificate returned"));
      else resolve(cert);
    });
    socket.setTimeout(8000, () => { socket.destroy(); reject(new Error("Connection timed out")); });
    socket.on("error", reject);
  });
}

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim()
    .replace(/^https?:\/\//, "").split("/")[0].toLowerCase();

  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  try {
    const cert = await fetchCert(domain);

    const notBefore = new Date(cert.valid_from);
    const notAfter = new Date(cert.valid_to);
    const daysLeft = Math.ceil((notAfter.getTime() - Date.now()) / 86400000);

    // Subject Alternative Names
    const sans: string[] = cert.subjectaltname
      ? cert.subjectaltname.split(", ").map((s) => s.replace(/^DNS:/, "")).slice(0, 8)
      : [];

    return NextResponse.json({
      domain,
      commonName: cert.subject?.CN || domain,
      issuer: cert.issuer?.CN || cert.issuer?.O || "Unknown",
      issuerOrg: cert.issuer?.O || null,
      notBefore: notBefore.toISOString(),
      notAfter: notAfter.toISOString(),
      daysLeft,
      valid: daysLeft > 0,
      fingerprint: cert.fingerprint || null,
      sans,
    });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : "SSL check failed",
    }, { status: 500 });
  }
}
