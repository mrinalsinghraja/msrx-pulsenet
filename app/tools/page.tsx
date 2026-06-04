"use client";

import { useState } from "react";
import {
  Globe, RotateCcw, BookOpen, FileCode, ArrowRightLeft,
  Lock, MapPin, Mail, Calculator, Activity, ShieldCheck, Wifi,
  Loader2, CheckCircle, XCircle, Wrench,
} from "lucide-react";

// ── Subnet calculator (pure client-side) ─────────────────────────────────────
function calcSubnet(cidr: string) {
  const [ipStr, prefixStr] = cidr.trim().split("/");
  const prefix = parseInt(prefixStr ?? "");
  if (!ipStr || isNaN(prefix) || prefix < 0 || prefix > 32) throw new Error("Use CIDR format: 192.168.1.0/24");
  const octets = ipStr.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) throw new Error("Invalid IP address");
  const ip32 = octets.reduce((a, b) => (a << 8) | b, 0) >>> 0;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip32 & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const n2ip = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  const hosts = prefix < 31 ? Math.pow(2, 32 - prefix) - 2 : Math.pow(2, 32 - prefix);
  return {
    network: n2ip(network),
    broadcast: n2ip(broadcast),
    mask: n2ip(mask),
    firstHost: n2ip(prefix < 31 ? network + 1 : network),
    lastHost: n2ip(prefix < 31 ? broadcast - 1 : broadcast),
    totalHosts: hosts,
    prefix,
  };
}

// ── Tool config ───────────────────────────────────────────────────────────────
type Field = {
  name: string; label: string; placeholder: string;
  type?: "text" | "select";
  options?: { value: string; label: string }[];
};

type Tool = {
  id: string; name: string; description: string;
  icon: React.ElementType; color: string; bg: string; border: string;
  fields: Field[];
  buildUrl: (inputs: Record<string, string>) => string | null;
};

const TOOLS: Tool[] = [
  {
    id: "dns", name: "DNS Lookup", description: "Query A, AAAA, CNAME, NS, TXT, SOA records",
    icon: Globe, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200",
    fields: [
      { name: "domain", label: "Domain", placeholder: "google.com" },
      { name: "type", label: "Type", placeholder: "A", type: "select",
        options: ["A","AAAA","CNAME","NS","TXT","SOA","CAA"].map((v) => ({ value: v, label: v })) },
    ],
    buildUrl: (i) => i.domain ? `/api/tools/dns?domain=${encodeURIComponent(i.domain)}&type=${i.type || "A"}` : null,
  },
  {
    id: "reverse", name: "Reverse DNS", description: "Resolve IP addresses back to hostnames via PTR",
    icon: RotateCcw, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200",
    fields: [{ name: "ip", label: "IP Address", placeholder: "8.8.8.8" }],
    buildUrl: (i) => {
      if (!i.ip) return null;
      const arpa = i.ip.split(".").reverse().join(".") + ".in-addr.arpa";
      return `/api/tools/dns?domain=${encodeURIComponent(arpa)}&type=PTR`;
    },
  },
  {
    id: "rdap", name: "WHOIS / RDAP", description: "Registrar, registration dates, nameservers",
    icon: BookOpen, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200",
    fields: [{ name: "domain", label: "Domain", placeholder: "github.com" }],
    buildUrl: (i) => i.domain ? `/api/tools/rdap?domain=${encodeURIComponent(i.domain)}` : null,
  },
  {
    id: "headers", name: "HTTP Headers", description: "Inspect response headers and status codes",
    icon: FileCode, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200",
    fields: [{ name: "url", label: "URL", placeholder: "https://example.com" }],
    buildUrl: (i) => i.url ? `/api/tools/headers?url=${encodeURIComponent(i.url)}` : null,
  },
  {
    id: "redirect", name: "Redirect Tracer", description: "Follow and map the full HTTP redirect chain",
    icon: ArrowRightLeft, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200",
    fields: [{ name: "url", label: "URL", placeholder: "http://bit.ly/example" }],
    buildUrl: (i) => i.url ? `/api/tools/redirect?url=${encodeURIComponent(i.url)}` : null,
  },
  {
    id: "ssl", name: "SSL Certificate", description: "Validity, expiry date, issuer, and cert chain",
    icon: Lock, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200",
    fields: [{ name: "domain", label: "Domain", placeholder: "github.com" }],
    buildUrl: (i) => i.domain ? `/api/tools/ssl?domain=${encodeURIComponent(i.domain)}` : null,
  },
  {
    id: "ip", name: "IP Geolocation", description: "Country, city, ISP, ASN — any IP or yours",
    icon: MapPin, color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-200",
    fields: [{ name: "ip", label: "IP Address (blank = your IP)", placeholder: "1.1.1.1" }],
    buildUrl: (i) => `/api/tools/ip-lookup${i.ip ? `?ip=${encodeURIComponent(i.ip)}` : ""}`,
  },
  {
    id: "mx", name: "MX Records", description: "Mail exchange servers and delivery priority",
    icon: Mail, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200",
    fields: [{ name: "domain", label: "Domain", placeholder: "gmail.com" }],
    buildUrl: (i) => i.domain ? `/api/tools/dns?domain=${encodeURIComponent(i.domain)}&type=MX` : null,
  },
  {
    id: "subnet", name: "Subnet Calculator", description: "CIDR to network, broadcast, hosts, mask",
    icon: Calculator, color: "text-lime-700", bg: "bg-lime-50", border: "border-lime-200",
    fields: [{ name: "cidr", label: "CIDR", placeholder: "192.168.1.0/24" }],
    buildUrl: () => null,
  },
  {
    id: "ping", name: "Ping / Reachability", description: "Check if a host responds and measure latency",
    icon: Activity, color: "text-green-600", bg: "bg-green-50", border: "border-green-200",
    fields: [{ name: "host", label: "Host or URL", placeholder: "cloudflare.com" }],
    buildUrl: (i) => i.host ? `/api/tools/ping?host=${encodeURIComponent(i.host)}` : null,
  },
  {
    id: "spf", name: "Email Auth Check", description: "Verify SPF, DMARC, and DKIM records",
    icon: ShieldCheck, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200",
    fields: [{ name: "domain", label: "Domain", placeholder: "gmail.com" }],
    buildUrl: (i) => i.domain ? `/api/tools/spf?domain=${encodeURIComponent(i.domain)}` : null,
  },
  {
    id: "port", name: "Port Checker", description: "Test if a TCP port is open on any host",
    icon: Wifi, color: "text-sky-600", bg: "bg-sky-50", border: "border-sky-200",
    fields: [
      { name: "host", label: "Host", placeholder: "example.com" },
      { name: "port", label: "Port / Service", placeholder: "443", type: "select",
        options: [
          {value:"21",label:"21 — FTP"},{value:"22",label:"22 — SSH"},{value:"25",label:"25 — SMTP"},
          {value:"53",label:"53 — DNS"},{value:"80",label:"80 — HTTP"},{value:"110",label:"110 — POP3"},
          {value:"143",label:"143 — IMAP"},{value:"443",label:"443 — HTTPS"},{value:"465",label:"465 — SMTPS"},
          {value:"587",label:"587 — SMTP Alt"},{value:"993",label:"993 — IMAPS"},{value:"995",label:"995 — POP3S"},
          {value:"3306",label:"3306 — MySQL"},{value:"5432",label:"5432 — PostgreSQL"},
          {value:"6379",label:"6379 — Redis"},{value:"8080",label:"8080 — HTTP Alt"},
          {value:"8443",label:"8443 — HTTPS Alt"},{value:"27017",label:"27017 — MongoDB"},
        ] },
    ],
    buildUrl: (i) => i.host ? `/api/tools/port?host=${encodeURIComponent(i.host)}&port=${i.port || "443"}` : null,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function StatusBadge({ code }: { code: number }) {
  const cls = code < 300 ? "bg-green-100 text-green-700" : code < 400 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${cls}`}>{code}</span>;
}

function Kv({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[13px] font-medium text-[var(--text-primary)] break-all">{value ?? "—"}</span>
    </div>
  );
}

// ── Result renderer ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Result({ toolId, data }: { toolId: string; data: any }) {
  const card = "bg-[var(--surface)] rounded-xl p-4";
  const mono = "font-mono text-[12px]";

  if (toolId === "dns" || toolId === "reverse" || toolId === "mx") {
    const answers: Array<{ type: string; ttl: number; value: string }> = data.answer ?? [];
    if (!answers.length) return <p className="text-[13px] text-[var(--text-secondary)]">No records found (NXDOMAIN or empty answer).</p>;

    if (toolId === "mx") {
      const parsed = answers.map((a) => {
        const parts = a.value.split(" ");
        return { priority: parseInt(parts[0]), exchange: parts.slice(1).join(" ").replace(/\.$/, "") };
      }).sort((a, b) => a.priority - b.priority);
      return (
        <div className="space-y-2">
          {parsed.map((mx, i) => (
            <div key={i} className={`${card} flex items-center gap-4`}>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <span className="text-[12px] font-bold text-indigo-700">{mx.priority}</span>
              </div>
              <div>
                <p className={`${mono} text-[var(--text-primary)]`}>{mx.exchange}</p>
                <p className="text-[11px] text-[var(--text-tertiary)]">Priority {mx.priority} · TTL {answers[i]?.ttl}s</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
            <tr>
              {["Type", "Value", "TTL"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-white">
            {answers.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-bold">{r.type}</span></td>
                <td className={`px-4 py-2.5 ${mono} text-[var(--text-primary)] break-all max-w-xs`}>{r.value.replace(/"/g, "")}</td>
                <td className="px-4 py-2.5 text-[var(--text-tertiary)]">{r.ttl}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (toolId === "rdap") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Kv label="Domain" value={data.domain} />
          <Kv label="Registrar" value={data.registrar} />
          <Kv label="Registered" value={fmtDate(data.registered)} />
          <Kv label="Expires" value={fmtDate(data.expires)} />
          <Kv label="Last Updated" value={fmtDate(data.updated)} />
          <Kv label="Status" value={
            <div className="flex flex-wrap gap-1 mt-0.5">
              {(data.status as string[])?.slice(0, 4).map((s: string) => (
                <span key={s} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium">{s}</span>
              ))}
            </div>
          } />
        </div>
        {data.nameservers?.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Nameservers</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(data.nameservers as string[]).map((ns: string) => (
                <span key={ns} className={`${card} ${mono} text-[var(--text-primary)] py-2 text-center`}>{ns}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (toolId === "headers") {
    const headers = data.headers as Record<string, string>;
    const importantKeys = ["content-type", "server", "cache-control", "content-security-policy", "strict-transport-security", "x-frame-options", "x-content-type-options", "x-xss-protection", "access-control-allow-origin"];
    return (
      <div className="space-y-3">
        <div className={`${card} flex items-center gap-3`}>
          <StatusBadge code={data.status} />
          <span className="text-[13px] text-[var(--text-secondary)]">{data.statusText}</span>
          <span className="ml-auto text-[12px] text-[var(--text-tertiary)]">{data.ms}ms</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Header</th>
                <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-white">
              {Object.entries(headers)
                .sort(([a], [b]) => {
                  const ai = importantKeys.indexOf(a), bi = importantKeys.indexOf(b);
                  if (ai !== -1 && bi !== -1) return ai - bi;
                  if (ai !== -1) return -1;
                  if (bi !== -1) return 1;
                  return a.localeCompare(b);
                })
                .map(([k, v]) => (
                  <tr key={k} className={importantKeys.includes(k) ? "bg-blue-50/30" : ""}>
                    <td className={`px-4 py-2 ${mono} text-[var(--text-secondary)] whitespace-nowrap`}>{k}</td>
                    <td className={`px-4 py-2 ${mono} text-[var(--text-primary)] break-all max-w-xs`}>{v}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (toolId === "redirect") {
    const hops: Array<{ url: string; status: number; ms: number; location: string | null }> = data.hops ?? [];
    return (
      <div className="space-y-2">
        {hops.map((hop, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === hops.length - 1 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {i + 1}
              </div>
              {i < hops.length - 1 && <div className="w-px flex-1 bg-[var(--border)] my-1" />}
            </div>
            <div className={`${card} flex-1 mb-1`}>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge code={hop.status} />
                <span className="text-[11px] text-[var(--text-tertiary)]">{hop.ms}ms</span>
              </div>
              <p className={`${mono} text-[12px] text-[var(--text-primary)] mt-1 break-all`}>{hop.url}</p>
              {hop.location && (
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">→ {hop.location}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (toolId === "ssl") {
    const daysLeft = data.daysLeft as number;
    const urgency = daysLeft < 0 ? "red" : daysLeft < 30 ? "amber" : "green";
    const colors = { red: "bg-red-50 text-red-700 border-red-100", amber: "bg-amber-50 text-amber-700 border-amber-100", green: "bg-green-50 text-green-700 border-green-100" };
    return (
      <div className="space-y-4">
        <div className={`p-4 rounded-xl border ${colors[urgency]} flex items-center gap-3`}>
          {daysLeft < 0 ? <XCircle size={20} /> : <CheckCircle size={20} />}
          <div>
            <p className="font-semibold text-[14px]">{daysLeft < 0 ? "Expired" : `Valid — ${daysLeft} days remaining`}</p>
            <p className="text-[12px] opacity-75">{data.commonName}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Kv label="Common Name" value={data.commonName} />
          <Kv label="Issuer" value={data.issuer} />
          <Kv label="Valid From" value={fmtDate(data.notBefore)} />
          <Kv label="Valid Until" value={fmtDate(data.notAfter)} />
          <Kv label="Days Left" value={daysLeft > 0 ? `${daysLeft} days` : "Expired"} />
          <Kv label="Fingerprint" value={
            <span className="font-mono text-[11px] break-all">{data.fingerprint || "—"}</span>
          } />
        </div>
        {data.sans?.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Subject Alternative Names</p>
            <div className="flex flex-wrap gap-1.5">
              {(data.sans as string[]).map((san: string) => (
                <span key={san} className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 text-[11px] font-mono">{san}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (toolId === "ip") {
    const [lat, lon] = (data.loc ?? "0,0").split(",");
    return (
      <div className="space-y-3">
        <div className={`${card} flex items-center gap-4`}>
          <span className="text-[40px] leading-none">{data.flag ?? "🌐"}</span>
          <div>
            <p className="text-[18px] font-bold font-mono text-[var(--text-primary)]">{data.ip}</p>
            <p className="text-[13px] text-[var(--text-secondary)]">{[data.city, data.region, data.country].filter(Boolean).join(", ")}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Kv label="ISP / Org" value={data.org} />
          <Kv label="Timezone" value={data.timezone} />
          <Kv label="Hostname" value={data.hostname} />
          <Kv label="Coordinates" value={lat && lon ? `${parseFloat(lat).toFixed(4)}°N, ${parseFloat(lon).toFixed(4)}°E` : "—"} />
        </div>
      </div>
    );
  }

  if (toolId === "subnet") {
    const fields = [
      { label: "Network Address", value: data.network },
      { label: "Broadcast Address", value: data.broadcast },
      { label: "Subnet Mask", value: data.mask },
      { label: "First Host", value: data.firstHost },
      { label: "Last Host", value: data.lastHost },
      { label: "Usable Hosts", value: data.totalHosts?.toLocaleString() },
      { label: "Prefix Length", value: `/${data.prefix}` },
    ];
    return (
      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ label, value }) => (
          <div key={label} className={card}>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">{label}</p>
            <p className="font-mono text-[15px] font-semibold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>
    );
  }

  if (toolId === "ping") {
    const ok = data.reachable as boolean;
    return (
      <div className="space-y-3">
        <div className={`p-5 rounded-xl border ${ok ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"} flex items-center gap-4`}>
          {ok ? <CheckCircle size={28} className="text-green-600 shrink-0" /> : <XCircle size={28} className="text-red-500 shrink-0" />}
          <div>
            <p className={`text-[18px] font-bold ${ok ? "text-green-700" : "text-red-600"}`}>{ok ? "Reachable" : "Unreachable"}</p>
            <p className="text-[12px] text-[var(--text-secondary)]">{data.host}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[22px] font-bold text-[var(--text-primary)]">{data.ms}<span className="text-[13px] font-normal text-[var(--text-secondary)] ml-1">ms</span></p>
            {data.status && <StatusBadge code={data.status} />}
          </div>
        </div>
      </div>
    );
  }

  if (toolId === "spf") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">SPF Record</p>
          {data.spf ? (
            <div className={`${card} font-mono text-[12px] text-[var(--text-primary)] break-all`}>{data.spf}</div>
          ) : (
            <div className={`${card} flex items-center gap-2 text-[13px] text-red-600`}><XCircle size={14} /> No SPF record found</div>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">DMARC Record</p>
          {data.dmarc ? (
            <div className={`${card} font-mono text-[12px] text-[var(--text-primary)] break-all`}>{data.dmarc}</div>
          ) : (
            <div className={`${card} flex items-center gap-2 text-[13px] text-red-600`}><XCircle size={14} /> No DMARC record found</div>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">DKIM Selectors Found</p>
          {data.dkim?.length > 0 ? (
            <div className="space-y-2">
              {(data.dkim as Array<{ selector: string; record: string }>).map((d) => (
                <div key={d.selector} className={`${card} flex gap-3`}>
                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-[11px] font-bold h-fit mt-0.5">{d.selector}</span>
                  <p className="font-mono text-[11px] text-[var(--text-secondary)] break-all">{d.record}…</p>
                </div>
              ))}
            </div>
          ) : (
            <div className={`${card} flex items-center gap-2 text-[13px] text-[var(--text-secondary)]`}>No common DKIM selectors found</div>
          )}
        </div>
      </div>
    );
  }

  if (toolId === "port") {
    const ok = data.open as boolean;
    return (
      <div className={`p-6 rounded-xl border ${ok ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"} flex items-center gap-5`}>
        {ok ? <CheckCircle size={32} className="text-green-600 shrink-0" /> : <XCircle size={32} className="text-red-500 shrink-0" />}
        <div>
          <p className={`text-[20px] font-bold ${ok ? "text-green-700" : "text-red-600"}`}>{ok ? "Port Open" : "Port Closed / Filtered"}</p>
          <p className="text-[13px] text-[var(--text-secondary)]">{data.host}:{data.port} ({data.service})</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[24px] font-bold text-[var(--text-primary)]">{data.ms}<span className="text-[13px] font-normal text-[var(--text-secondary)] ml-1">ms</span></p>
        </div>
      </div>
    );
  }

  return <pre className="text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap break-all">{JSON.stringify(data, null, 2)}</pre>;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState<string>(TOOLS[0].id);
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tool = TOOLS.find((t) => t.id === activeTool)!;
  const toolInputs = inputs[activeTool] ?? {};

  function setInput(field: string, value: string) {
    setInputs((prev) => ({ ...prev, [activeTool]: { ...prev[activeTool], [field]: value } }));
  }

  function selectTool(id: string) {
    setActiveTool(id);
    setResult(null);
    setError("");
  }

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setError("");
    setLoading(true);

    try {
      if (activeTool === "subnet") {
        const cidr = toolInputs.cidr?.trim();
        if (!cidr) throw new Error("Enter a CIDR (e.g. 192.168.1.0/24)");
        const data = calcSubnet(cidr);
        setResult(data);
        setLoading(false);
        return;
      }

      const url = tool.buildUrl(toolInputs);
      if (!url) throw new Error(`Enter ${tool.fields[0].label.toLowerCase()} to continue`);

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error || "Request failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-[var(--border-strong)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all bg-white";

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Wrench size={18} className="text-[var(--text-secondary)]" />
          <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight">Network Tools</h1>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-blue-400 to-violet-500 text-white">12 tools</span>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)]">Professional diagnostics — DNS, WHOIS, SSL, headers, routing, and more</p>
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 mb-5">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => selectTool(t.id)}
              className={`text-left p-3 rounded-2xl border transition-all duration-150 ${
                active
                  ? `${t.bg} ${t.border} shadow-sm`
                  : "bg-white border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-sm"
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${active ? t.bg : "bg-[var(--surface)]"}`}>
                <Icon size={15} className={active ? t.color : "text-[var(--text-tertiary)]"} />
              </div>
              <p className={`font-semibold text-[12px] leading-tight mb-0.5 ${active ? t.color : "text-[var(--text-primary)]"}`}>{t.name}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] leading-tight line-clamp-2">{t.description}</p>
            </button>
          );
        })}
      </div>

      {/* Active tool panel */}
      <div className="bg-white rounded-2xl border border-[var(--border)]" style={{ boxShadow: "var(--shadow-card)" }}>
        {/* Tool header */}
        <div className={`px-5 py-4 rounded-t-2xl border-b border-[var(--border)] ${tool.bg} flex items-center gap-3`}>
          {(() => { const Icon = tool.icon; return <Icon size={18} className={tool.color} />; })()}
          <div>
            <p className={`font-bold text-[15px] ${tool.color}`}>{tool.name}</p>
            <p className="text-[12px] text-[var(--text-secondary)]">{tool.description}</p>
          </div>
        </div>

        {/* Input form */}
        <form onSubmit={handleRun} className="p-5">
          <div className={`grid gap-3 mb-4 ${tool.fields.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {tool.fields.map((field) => (
              <div key={field.name}>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  {field.label}
                </label>
                {field.type === "select" ? (
                  <select
                    value={toolInputs[field.name] ?? field.options?.[0]?.value ?? ""}
                    onChange={(e) => setInput(field.name, e.target.value)}
                    className={inputCls}
                  >
                    {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    value={toolInputs[field.name] ?? ""}
                    onChange={(e) => setInput(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className={inputCls}
                    autoComplete="off"
                    spellCheck={false}
                  />
                )}
              </div>
            ))}
          </div>
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <Loader2 size={13} className="animate-spin" /> : null}
            {loading ? "Running…" : "Run Analysis"}
          </button>
        </form>

        {/* Results */}
        {(result || error) && (
          <div className="px-5 pb-5 border-t border-[var(--border)] pt-4">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Results</p>
            {error ? (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">{error}</div>
            ) : (
              <Result toolId={activeTool} data={result} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
