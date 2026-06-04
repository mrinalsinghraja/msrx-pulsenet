import { NextRequest, NextResponse } from "next/server";

const DOH = "https://dns.google/resolve";
const DKIM_SELECTORS = ["google", "selector1", "selector2", "default", "mail", "dkim", "k1", "s1", "s2"];

async function dohTXT(name: string): Promise<string[]> {
  const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=TXT`, {
    headers: { Accept: "application/dns-json" },
    signal: AbortSignal.timeout(5000),
  });
  const data = await res.json();
  return (data.Answer || []).map((r: { data: string }) => r.data.replace(/^"|"$/g, "").replace(/" "/g, ""));
}

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim()
    .replace(/^https?:\/\//, "").split("/")[0].toLowerCase();

  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  try {
    const [txtRecords, dmarcRecords] = await Promise.allSettled([
      dohTXT(domain),
      dohTXT("_dmarc." + domain),
    ]);

    const txt = txtRecords.status === "fulfilled" ? txtRecords.value : [];
    const dmarc = dmarcRecords.status === "fulfilled" ? dmarcRecords.value : [];

    const spfRecord = txt.find((r) => r.startsWith("v=spf1")) || null;
    const dmarcRecord = dmarc.find((r) => r.startsWith("v=DMARC1")) || null;

    const dkimChecks = await Promise.allSettled(
      DKIM_SELECTORS.slice(0, 6).map(async (sel) => {
        const records = await dohTXT(`${sel}._domainkey.${domain}`);
        const found = records.find((r) => r.includes("v=DKIM1") || r.includes("p="));
        return { selector: sel, found: !!found, record: found?.substring(0, 100) || null };
      })
    );

    const dkim = dkimChecks
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<{ selector: string; found: boolean; record: string | null }>).value)
      .filter((r) => r.found);

    return NextResponse.json({ domain, spf: spfRecord, dmarc: dmarcRecord, dkim });
  } catch {
    return NextResponse.json({ error: "Email auth lookup failed" }, { status: 500 });
  }
}
