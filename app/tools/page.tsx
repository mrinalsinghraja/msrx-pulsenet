"use client";

import { useState, useEffect } from "react";
import {
  Globe, RotateCcw, BookOpen, FileCode, ArrowRightLeft,
  Lock, MapPin, Mail, Calculator, Activity, ShieldCheck, Wifi,
  Loader2, CheckCircle, XCircle, Wrench, Fingerprint, Network,
  ShieldAlert, Radio, Info, ChevronDown, Sparkles,
} from "lucide-react";
import { DownloadButton } from "@/app/components/DownloadButton";

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

// ── Tool documentation ────────────────────────────────────────────────────────
type ToolDoc = { about: string; technical: string; interpret: string };

const TOOL_DOCS: Record<string, ToolDoc> = {
  dns: {
    about: "DNS Lookup queries the Domain Name System to retrieve various record types for any domain. DNS is the internet's phonebook — it translates human-readable names like 'google.com' into IP addresses computers understand. Different record types serve different purposes.",
    technical: "Record types: A = IPv4 address mapping | AAAA = IPv6 address | CNAME = canonical alias (one domain points to another) | NS = authoritative nameservers for the domain | TXT = arbitrary text, commonly SPF email authentication | SOA = Start of Authority, zone metadata + primary nameserver | CAA = Certificate Authority Authorization, controls which CAs can issue SSL certs.",
    interpret: "Fast DNS response (<50ms) = good. Multiple A records = load balancing or CDN. CNAME chains should be short (1–2 hops). No NS records = misconfigured zone. TXT records with 'v=spf1' = SPF email policy configured.",
  },
  reverse: {
    about: "Reverse DNS resolves an IP address back to a hostname using PTR records. This is the opposite of a normal DNS lookup. It's used to verify that an IP address is legitimately associated with a hostname — critical for email deliverability and network troubleshooting.",
    technical: "Queries the special 'in-addr.arpa' zone. For IP 8.8.8.8, the PTR lookup queries 8.8.8.8.in-addr.arpa. Reverse DNS is set by the IP block owner (usually your ISP or cloud provider), not the domain registrant.",
    interpret: "If PTR resolves to a hostname, the IP has valid reverse DNS. No PTR = rDNS not configured (common for residential IPs). Mail servers without rDNS configured are often flagged as spam. Mismatch between forward and reverse DNS can indicate misconfiguration.",
  },
  rdap: {
    about: "WHOIS/RDAP retrieves domain registration data from the official registry. RDAP (Registration Data Access Protocol) is the modern successor to the older WHOIS protocol, providing structured JSON data about domain ownership, registrar, and important dates.",
    technical: "Queries rdap.org which aggregates all TLD registry APIs. RDAP replaced WHOIS to provide consistent, machine-readable output. Data includes registrar name, registration and expiration dates, nameservers, and domain status codes.",
    interpret: "Check expiration date to avoid accidental domain loss. 'clientDeleteProhibited' / 'clientTransferProhibited' statuses = domain is locked (good security practice). Nameservers should match your DNS provider. Old registration dates indicate established domains.",
  },
  headers: {
    about: "HTTP Header Inspector fetches the response headers from any URL without downloading the full page body. Headers contain critical metadata about the server, caching policy, content type, security settings, and redirects. They're essential for debugging web issues.",
    technical: "Sends an HTTP HEAD request (or GET if HEAD fails) to the target URL. Returns status code, all response headers, and response time. Follows redirects automatically and shows the final URL.",
    interpret: "Status 200 = OK. 301/302 = redirects. 404 = not found. 500 = server error. Check 'server' header to identify software. 'cache-control' shows caching policy. 'strict-transport-security' = HTTPS forced. 'content-security-policy' = XSS protection.",
  },
  redirect: {
    about: "Redirect Tracer follows the complete chain of HTTP redirects from a starting URL to its final destination. Useful for auditing URL shorteners, checking SEO redirect chains, verifying HTTPS upgrades, and diagnosing redirect loops.",
    technical: "Follows each HTTP redirect manually (301, 302, 303, 307, 308) up to 12 hops. Reports the status code, URL, and response time at each step. Does not execute JavaScript redirects.",
    interpret: "Ideal chain: HTTP → HTTPS → final URL (2 hops). More hops = slower page load. Redirect loops = error. Mixed HTTP/HTTPS in chain = potential security issue. 302 (temporary) instead of 301 (permanent) = not SEO-optimized.",
  },
  ssl: {
    about: "SSL Certificate Checker uses a direct TLS connection to retrieve the live certificate from any domain. SSL/TLS certificates encrypt traffic between browsers and servers, authenticate the server's identity, and are required for HTTPS.",
    technical: "Opens a TLS connection on port 443 and inspects the server's certificate. Returns the certificate's Common Name, issuer, validity dates, fingerprint, and Subject Alternative Names (SANs — additional domains the cert covers).",
    interpret: "Days remaining > 30 = healthy. Under 14 days = urgent renewal needed. Expired = browsers show security warnings. Issuer 'Let's Encrypt' = free auto-renewed cert. Wildcard CN (*.domain.com) = covers all subdomains. Check SANs to see all covered domains.",
  },
  ip: {
    about: "IP Geolocation maps any IP address to its approximate geographic location, ISP, and organization. Useful for understanding CDN routing, diagnosing regional connectivity issues, verifying VPN exit nodes, and network security investigations.",
    technical: "Queries ipinfo.io which maintains a global IP-to-location database. Leave the field blank to geolocate your own IP. Data includes city, region, country, timezone, ISP/organization name, and ASN (Autonomous System Number).",
    interpret: "Location accuracy varies — city-level is typically accurate, street-level is not reliable. ASN identifies the network owner (ISP or company). VPNs show the VPN provider's location. Differences between your IP location and your actual location = VPN or proxy in use.",
  },
  mx: {
    about: "MX Record Checker queries mail exchange records for a domain, revealing which mail servers handle email delivery for that domain. Essential for email troubleshooting, migration planning, and verifying mail server configuration.",
    technical: "Queries DNS MX record type via Google DNS-over-HTTPS. MX records contain a priority number and a mail server hostname. Lower priority number = higher preference. Multiple MX records provide redundancy.",
    interpret: "Google Workspace uses aspmx.l.google.com. Microsoft 365 uses *.mail.protection.outlook.com. No MX records = domain can't receive email. Multiple records = failover configured (good). All pointing to same server = single point of failure.",
  },
  subnet: {
    about: "Subnet Calculator converts CIDR notation into full network details. Subnetting divides IP address space into logical networks. Understanding subnet boundaries is essential for network design, firewall rules, and cloud VPC configuration.",
    technical: "Takes CIDR notation (e.g., 192.168.1.0/24) where the number after '/' is the prefix length. Calculates the network address, broadcast address, subnet mask, first/last usable host IPs, and total host count. Pure client-side math — no network requests.",
    interpret: "/24 = 254 usable hosts (most common). /16 = 65,534 hosts. /32 = single host. /0 = entire internet. Network address (first IP) and broadcast (last IP) are not usable. Hosts must share a subnet to communicate directly without routing.",
  },
  ping: {
    about: "Ping / Reachability checks whether a host is online and measures how long it takes to receive a response. While traditional ICMP ping isn't available in browser-based tools, this performs an HTTP HEAD request which provides equivalent reachability information.",
    technical: "Sends an HTTP HEAD request to the target host with a 10-second timeout. Returns reachability status, HTTP status code, and round-trip time in milliseconds. Runs from PulseNet's Vercel edge infrastructure (not from your local machine).",
    interpret: "Under 100ms = excellent. 100–300ms = good. Over 300ms = high latency. Unreachable = firewall blocking, service down, or DNS failure. Note: this measures round-trip from PulseNet servers, not from your machine.",
  },
  spf: {
    about: "Email Auth Check verifies SPF, DMARC, and DKIM records — the three pillars of email authentication. Misconfigured email authentication causes legitimate emails to land in spam and allows domain impersonation for phishing.",
    technical: "SPF (Sender Policy Framework): TXT record listing authorized mail servers. DMARC (Domain-based Message Authentication): policy for handling SPF/DKIM failures. DKIM (DomainKeys Identified Mail): cryptographic signature in TXT at selector._domainkey.domain. Checks 6 common DKIM selectors.",
    interpret: "SPF missing = anyone can send email as your domain. DMARC missing = failures not reported/rejected. 'p=reject' in DMARC = strongest protection. 'p=none' = monitoring only. DKIM found = emails signed and verifiable. All three present = well-secured email domain.",
  },
  port: {
    about: "Port Checker tests whether a specific TCP port is open and accepting connections on a remote host. Every service on the internet listens on a port — HTTP on 80, HTTPS on 443, SSH on 22, etc. Port checking reveals which services are exposed.",
    technical: "Opens a TCP connection to the specified host:port with a 6-second timeout. Returns whether the connection was accepted (open) or rejected/timed out (closed/filtered). Limited to common well-known ports to prevent abuse.",
    interpret: "Open = service is running and accessible. Closed = port actively refused (service not running). Filtered = firewall blocking (no response). Finding open unexpected ports = potential security issue. SSH (22) open on public internet = brute-force risk.",
  },
  "dns-intel": {
    about: "DNS Intelligence combines a full DNS lookup with IP geolocation, ISP identification, and domain category classification in a single enriched query. It goes beyond raw DNS records to give you the complete picture of where a domain resolves and who owns that infrastructure.",
    technical: "Performs an A record DNS lookup, then passes the resolved IP to ipinfo.io for geolocation and ASN data. Category detection identifies CDN, Cloud, Search, Social Media, Streaming, or Knowledge domains based on hostname and ISP patterns.",
    interpret: "Category helps identify infrastructure type (CDN = Cloudflare/Akamai, Cloud = AWS/GCP/Azure). DNS timing shows resolver speed. Country flag shows where the server is physically located. ISP reveals cloud provider or hosting company.",
  },
  traceroute: {
    about: "Traceroute maps the network path between PulseNet servers and your target host, showing each intermediate router (hop) along the way. It reveals routing inefficiencies, identifies where latency is introduced, and diagnoses where connectivity problems occur.",
    technical: "Uses HackerTarget's MTR API which performs multiple-path traceroute with loss statistics. Each hop shows hostname/IP, packet loss percentage, and average/best/worst round-trip times. Powered by mtr (Matt's Traceroute) from PulseNet's edge infrastructure.",
    interpret: "Rising latency at a hop = congestion at that router. 100% loss at a hop but traffic continues = router blocks ICMP (normal, not a failure). High loss at final hop = actual packet loss. '???' hops = router not responding to probes. Unexpected geographic hops = suboptimal routing.",
  },
  security: {
    about: "HTTP Security Score audits a website's security-related HTTP response headers and grades its security posture from A to F. These headers are the first line of defense against common web attacks like XSS, clickjacking, and data injection.",
    technical: "Fetches response headers then scores 6 critical security headers: HSTS (forces HTTPS), CSP (Content Security Policy, prevents XSS), X-Frame-Options (prevents clickjacking), X-Content-Type-Options (prevents MIME sniffing), Referrer-Policy (controls referrer data), Permissions-Policy (limits browser API access).",
    interpret: "Grade A (90+) = excellent security posture. Grade F = major headers missing, vulnerable to common attacks. HSTS missing = HTTPS not enforced. CSP missing = XSS vulnerable. X-Frame-Options missing = clickjacking possible. Even major sites often score B or C.",
  },
  propagation: {
    about: "DNS Propagation Checker queries 4 major public DNS resolvers worldwide simultaneously to verify whether DNS changes have propagated consistently. After changing DNS records, propagation can take minutes to 48 hours depending on TTL settings.",
    technical: "Queries Google (8.8.8.8), Cloudflare (1.1.1.1), Quad9 (9.9.9.9), and AdGuard DNS resolvers in parallel via DNS-over-HTTPS. Compares answers across resolvers to detect inconsistencies.",
    interpret: "All resolvers return same value = fully propagated. Different values = still propagating (old TTL cached on some resolvers). No records from some resolvers = partial failure. Propagation speed depends on old TTL — lower TTL = faster propagation but more DNS load.",
  },
};

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
  {
    id: "dns-intel",
    name: "DNS Intelligence",
    description: "Full DNS resolve with IP geo, ISP, country, and category",
    icon: Fingerprint,
    color: "text-teal-600",
    bg: "bg-teal-50",
    border: "border-teal-200",
    fields: [{ name: "domain", label: "Domain", placeholder: "cloudflare.com" }],
    buildUrl: (i) => i.domain ? `/api/dns/lookup?domain=${encodeURIComponent(i.domain)}` : null,
  },
  {
    id: "traceroute",
    name: "Traceroute",
    description: "Hop-by-hop path with latency and packet loss at each node",
    icon: Network,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    fields: [{ name: "host", label: "Host", placeholder: "google.com" }],
    buildUrl: (i) => i.host ? `/api/tools/traceroute?host=${encodeURIComponent(i.host)}` : null,
  },
  {
    id: "security",
    name: "HTTP Security Score",
    description: "Grade security headers: HSTS, CSP, X-Frame-Options, and more",
    icon: ShieldAlert,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    fields: [{ name: "url", label: "URL", placeholder: "https://example.com" }],
    buildUrl: (i) => i.url ? `/api/tools/headers?url=${encodeURIComponent(i.url)}` : null,
  },
  {
    id: "propagation",
    name: "DNS Propagation",
    description: "Check if DNS changes have propagated across global resolvers",
    icon: Radio,
    color: "text-fuchsia-600",
    bg: "bg-fuchsia-50",
    border: "border-fuchsia-200",
    fields: [
      { name: "domain", label: "Domain", placeholder: "example.com" },
      { name: "type", label: "Type", placeholder: "A", type: "select",
        options: ["A", "AAAA", "CNAME", "MX", "TXT", "NS"].map((v) => ({ value: v, label: v })) },
    ],
    buildUrl: (i) => i.domain ? `/api/tools/dns-propagation?domain=${encodeURIComponent(i.domain)}&type=${i.type || "A"}` : null,
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

  if (toolId === "security") {
    const headers = data.headers as Record<string, string>;
    const checks = [
      { key: "strict-transport-security", label: "HSTS", pts: 20, tip: "Force HTTPS for all connections" },
      { key: "content-security-policy", label: "Content Security Policy", pts: 25, tip: "Prevent XSS and injection attacks" },
      { key: "x-frame-options", label: "X-Frame-Options", pts: 15, tip: "Block clickjacking via iframes" },
      { key: "x-content-type-options", label: "X-Content-Type-Options", pts: 10, tip: "Prevent MIME-type sniffing" },
      { key: "referrer-policy", label: "Referrer-Policy", pts: 15, tip: "Control referrer info on links" },
      { key: "permissions-policy", label: "Permissions-Policy", pts: 15, tip: "Control browser feature access" },
    ];
    const score = checks.reduce((s, c) => s + (headers[c.key] ? c.pts : 0), 0);
    const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 55 ? "C" : score >= 35 ? "D" : "F";
    const gradeColor = { A: "text-green-700 bg-green-50 border-green-200", B: "text-green-600 bg-green-50 border-green-100", C: "text-amber-700 bg-amber-50 border-amber-200", D: "text-orange-700 bg-orange-50 border-orange-200", F: "text-red-700 bg-red-50 border-red-200" }[grade]!;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-[28px] font-black ${gradeColor}`}>{grade}</div>
          <div>
            <p className="text-[18px] font-bold text-[var(--text-primary)]">{score}/100</p>
            <p className="text-[12px] text-[var(--text-secondary)]">{data.url} · {data.status}</p>
          </div>
        </div>
        <div className="space-y-2">
          {checks.map((c) => {
            const present = !!headers[c.key];
            return (
              <div key={c.key} className={`${card} flex items-start gap-3`}>
                {present ? <CheckCircle size={15} className="text-green-500 mt-0.5 shrink-0" /> : <XCircle size={15} className="text-red-400 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">{c.label}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${present ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>+{c.pts}pts</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-tertiary)]">{c.tip}</p>
                  {present && <p className={`${mono} text-[11px] text-[var(--text-secondary)] mt-0.5 truncate`}>{headers[c.key]}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (toolId === "propagation") {
    const resolvers: Array<{ name: string; flag: string; ms: number; answers: Array<{value: string; ttl: number}>; status: number; error: string | null }> = data.resolvers ?? [];
    const allAnswers = resolvers.flatMap((r) => r.answers.map((a) => a.value));
    const uniqueAnswers = [...new Set(allAnswers)];
    return (
      <div className="space-y-4">
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${data.propagated && data.consistent ? "bg-green-50 border-green-100" : data.consistent ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100"}`}>
          {data.propagated && data.consistent ? <CheckCircle size={18} className="text-green-600 shrink-0" /> : <XCircle size={18} className="text-amber-600 shrink-0" />}
          <div>
            <p className="font-semibold text-[14px] text-[var(--text-primary)]">
              {data.propagated && data.consistent ? "Fully propagated — all resolvers agree" : data.consistent ? "Inconsistent — resolvers return different answers" : "Some resolvers returned no records"}
            </p>
            <p className="text-[12px] text-[var(--text-secondary)]">{uniqueAnswers.length} unique value{uniqueAnswers.length !== 1 ? "s" : ""} across {resolvers.length} resolvers</p>
          </div>
        </div>
        <div className="space-y-2">
          {resolvers.map((r) => (
            <div key={r.name} className={`${card} flex items-start gap-3`}>
              <span className="text-[18px] leading-none mt-0.5">{r.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[13px] text-[var(--text-primary)]">{r.name}</p>
                  <span className="text-[11px] text-[var(--text-tertiary)]">{r.ms}ms</span>
                  {r.error && <span className="text-[10px] text-red-500 font-medium">timeout</span>}
                </div>
                {r.answers.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.answers.map((a, i) => (
                      <span key={i} className={`${mono} text-[11px] px-2 py-0.5 rounded-full ${uniqueAnswers.length > 1 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{a.value}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">No records returned</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {uniqueAnswers.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">All Resolved Values</p>
            <div className="flex flex-wrap gap-2">
              {uniqueAnswers.map((v) => (
                <span key={v} className={`${mono} text-[12px] px-3 py-1 rounded-full border ${data.propagated ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>{v}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (toolId === "dns-intel") {
    const catColors: Record<string, string> = {
      CDN: "bg-blue-100 text-blue-700", Cloud: "bg-violet-100 text-violet-700",
      Search: "bg-amber-100 text-amber-700", "Social Media": "bg-pink-100 text-pink-700",
      Streaming: "bg-red-100 text-red-700", Knowledge: "bg-green-100 text-green-700",
      Unknown: "bg-gray-100 text-gray-600",
    };
    return (
      <div className="space-y-4">
        <div className={`${card} flex items-center gap-4`}>
          <span className="text-[42px] leading-none">{data.flag ?? "🌐"}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-[16px] text-[var(--text-primary)]">{data.domain}</p>
              {data.category && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${catColors[data.category] ?? catColors.Unknown}`}>{data.category}</span>
              )}
            </div>
            <p className={`${mono} text-[13px] text-[var(--text-secondary)] mt-0.5`}>{data.ip ?? "—"}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[22px] font-bold text-[var(--text-primary)]">{data.dnsMs != null ? Number(data.dnsMs).toFixed(1) : "—"}</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">DNS ms</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Kv label="Country" value={data.country} />
          <Kv label="ISP / Org" value={data.org ? String(data.org).replace(/^AS\d+ /, "") : "—"} />
        </div>
      </div>
    );
  }

  if (toolId === "traceroute") {
    // ── MTR mode (local traceroute/tracepath/mtr/hackertarget) ─────────────
    // NOTE: do NOT use `|| data.hops` here — [] empty array is truthy in JS
    if (data.mode === "mtr") {
      const hops: Array<{ hop: number; host: string; loss: number; avg: number; best: number; worst: number; timeout: boolean }> = data.hops ?? [];
      if (hops.length === 0) {
        return <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-[13px] text-amber-700">No hops returned — host may block TCP/ICMP probes entirely. Try a more accessible host (e.g. google.com).</div>;
      }
      const maxAvg = Math.max(...hops.filter((h) => !h.timeout).map((h) => h.avg), 1);
      const srcLabel: Record<string, string> = { traceroute: "TCP Traceroute", tracepath: "Tracepath (UDP)", mtr: "MTR Report", hackertarget: "HackerTarget MTR" };
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-[13px] font-semibold ${data.reachable ? "text-green-600" : "text-red-500"}`}>
              {data.reachable ? `✓ Reached ${data.host}` : `✗ Destination unreachable — probes blocked or host down`}
            </span>
            {data.totalMs > 0 && <span className="text-[12px] text-[var(--text-tertiary)]">avg {Number(data.totalMs).toFixed(1)}ms</span>}
            <span className="text-[12px] text-[var(--text-tertiary)]">{hops.length} hops</span>
            {data.source && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{srcLabel[data.source] ?? data.source}</span>}
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-[12px] text-left">
              <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
                <tr>{["#", "Host", "Loss", "Avg ms", "Best", "Worst", "Bar"].map((h) => (
                  <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-white">
                {hops.map((hop) => {
                  const barPct = hop.timeout ? 100 : Math.round((hop.avg / maxAvg) * 100);
                  const barColor = hop.timeout ? "bg-gray-200" : hop.avg < 20 ? "bg-green-400" : hop.avg < 80 ? "bg-amber-400" : "bg-red-400";
                  return (
                    <tr key={hop.hop} className={hop.timeout ? "opacity-50" : ""}>
                      <td className="px-3 py-2 text-[var(--text-tertiary)] font-mono">{hop.hop}</td>
                      <td className="px-3 py-2 font-mono text-[var(--text-primary)] max-w-[180px] truncate">{hop.host}</td>
                      <td className="px-3 py-2"><span className={`text-[11px] font-semibold ${hop.loss > 0 ? "text-red-500" : "text-green-600"}`}>{hop.loss}%</span></td>
                      <td className="px-3 py-2 font-mono text-[var(--text-primary)]">{hop.timeout ? "—" : hop.avg.toFixed(1)}</td>
                      <td className="px-3 py-2 font-mono text-[var(--text-tertiary)]">{hop.timeout ? "—" : hop.best.toFixed(1)}</td>
                      <td className="px-3 py-2 font-mono text-[var(--text-tertiary)]">{hop.timeout ? "—" : hop.worst.toFixed(1)}</td>
                      <td className="px-3 py-2 w-24"><div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden"><div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} /></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ── Analysis mode (HackerTarget rate-limited — BGP + geo fallback) ─────
    if (data.mode === "analysis") {
      return (
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[12px] text-amber-700">
            ⚠ All traceroute methods unavailable from Vercel edge (traceroute/tracepath binary access denied). Showing BGP + geolocation intelligence instead.
          </div>
          <div className={`${card} flex items-center gap-4`}>
            <span className="text-[40px] leading-none">{data.flag ?? "🌐"}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[16px] text-[var(--text-primary)]">{data.host}</p>
              <p className={`${mono} text-[13px] text-[var(--text-secondary)]`}>{data.ip}</p>
              <p className="text-[12px] text-[var(--text-tertiary)]">{[data.city, data.region, data.country].filter(Boolean).join(", ")}</p>
            </div>
            {data.latencyMs != null && (
              <div className="text-right">
                <p className="text-[22px] font-bold text-[var(--text-primary)]">{data.latencyMs}</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">ms ping</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Kv label="Hostname" value={data.hostname ?? "—"} />
            <Kv label="ISP / Org" value={data.org?.replace(/^AS\d+ /, "") ?? "—"} />
            {data.bgpAsn && <Kv label="BGP ASN" value={`AS${data.bgpAsn} — ${data.bgpAsnName ?? ""}`} />}
            {data.bgpPrefix && <Kv label="BGP Prefix" value={data.bgpPrefix} />}
            <Kv label="Timezone" value={data.timezone ?? "—"} />
            {data.loc && <Kv label="Coordinates" value={data.loc} />}
          </div>
        </div>
      );
    }
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
  const [infoOpen, setInfoOpen] = useState(true);
  const [aiInterpret, setAiInterpret] = useState<{ summary: string; findings: string[]; recommendations: string[] } | null>(null);
  const [aiInterpretLoading, setAiInterpretLoading] = useState(false);

  // Fetch AI interpretation whenever result changes
  useEffect(() => {
    if (!result) { setAiInterpret(null); return; }
    setAiInterpretLoading(true);
    setAiInterpret(null);
    const tool = TOOLS.find((t) => t.id === activeTool);
    fetch("/api/ai/tool-interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolId: activeTool, toolName: tool?.name ?? activeTool, result }),
    })
      .then(r => r.json())
      .then(data => { setAiInterpret(data); setAiInterpretLoading(false); })
      .catch(() => setAiInterpretLoading(false));
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  const tool = TOOLS.find((t) => t.id === activeTool)!;
  const toolInputs = inputs[activeTool] ?? {};

  function setInput(field: string, value: string) {
    setInputs((prev) => ({ ...prev, [activeTool]: { ...prev[activeTool], [field]: value } }));
  }

  function selectTool(id: string) {
    setActiveTool(id);
    setResult(null);
    setError("");
    setInfoOpen(true);
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
          <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-blue-400 to-violet-500 text-white">{TOOLS.length} tools</span>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)]">Professional diagnostics — DNS, WHOIS, SSL, headers, routing, and more</p>
      </div>

      {/* AI capability banner */}
      <div className="mb-5 rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4c1d95 100%)", boxShadow: "0 4px 24px rgba(139,92,246,0.25)" }}>
        <div className="px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[13px] font-bold text-white">AI-Powered Tool Interpretation</p>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ background: "rgba(139,92,246,0.5)", border: "1px solid rgba(167,139,250,0.4)" }}>
                  Groq · Llama 3.3 70B
                </span>
              </div>
              <p className="text-[11px]" style={{ color: "rgba(200,210,255,0.75)" }}>
                Every result is automatically analysed — plain-English insights, findings flagged ⚠ or ✓, and actionable recommendations.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-400" />
            <span className="text-[10px] font-semibold" style={{ color: "rgba(167,239,200,0.9)" }}>AI Active</span>
          </div>
        </div>
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
      <div id="tool-result-panel" className="bg-white rounded-2xl border border-[var(--border)]" style={{ boxShadow: "var(--shadow-card)" }}>
        {/* Tool header */}
        <div className={`px-5 py-4 rounded-t-2xl border-b border-[var(--border)] ${tool.bg} flex items-center gap-3`}>
          {(() => { const Icon = tool.icon; return <Icon size={18} className={tool.color} />; })()}
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-[15px] ${tool.color}`}>{tool.name}</p>
            <p className="text-[12px] text-[var(--text-secondary)]">{tool.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 pn-no-print">
            {result && <DownloadButton targetId="tool-result-panel" filename={`pulsenet-${activeTool}`} label="Export" />}
          </div>
        </div>

        {/* Tool documentation panel */}
        {TOOL_DOCS[activeTool] && (
          <div className="border-b border-[var(--border)]">
            <button
              onClick={() => setInfoOpen((v) => !v)}
              className={`w-full flex items-center gap-2.5 px-5 py-3 text-left hover:bg-[var(--surface)] transition-colors`}
            >
              <Info size={13} className="text-blue-500 shrink-0" />
              <span className="text-[12px] font-semibold text-[var(--text-secondary)] flex-1">About this tool</span>
              <ChevronDown size={13} className={`text-[var(--text-tertiary)] transition-transform ${infoOpen ? "rotate-180" : ""}`} />
            </button>
            {infoOpen && (
              <div className="px-5 pb-4 space-y-3">
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{TOOL_DOCS[activeTool].about}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1.5">⚙ How it works</p>
                    <p className="text-[12px] text-blue-900 leading-relaxed">{TOOL_DOCS[activeTool].technical}</p>
                  </div>
                  <div className="bg-violet-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wider mb-1.5">📊 Interpreting Results</p>
                    <p className="text-[12px] text-violet-900 leading-relaxed">{TOOL_DOCS[activeTool].interpret}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Results</p>
              {result && (
                <div className="pn-no-print">
                  <DownloadButton targetId="tool-result-panel" filename={`pulsenet-${activeTool}`} label="Export Results" />
                </div>
              )}
            </div>
            {error ? (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">{error}</div>
            ) : (
              <Result toolId={activeTool} data={result} />
            )}

            {/* AI Interpretation tile */}
            {!error && (aiInterpretLoading || aiInterpret) && (
              <div className="mt-4 rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(139,92,246,0.2)" }}>
                {/* Dark header */}
                <div className="px-4 py-3 flex items-center gap-2.5"
                  style={{ background: "linear-gradient(90deg, #1e1b4b 0%, #312e81 100%)" }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
                    <Sparkles size={11} className="text-white" />
                  </div>
                  <p className="text-[12px] font-bold text-white flex-1">AI Interpretation</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-400" />
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ background: "rgba(139,92,246,0.45)", border: "1px solid rgba(139,92,246,0.5)" }}>
                      Groq · Llama 3.3
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4" style={{ background: "linear-gradient(135deg, rgba(30,27,75,0.03) 0%, rgba(139,92,246,0.04) 100%)" }}>
                  {aiInterpretLoading ? (
                    <div className="space-y-2.5">
                      <div className="h-3 rounded-full animate-pulse w-full" style={{ background: "rgba(139,92,246,0.1)" }} />
                      <div className="h-3 rounded-full animate-pulse w-5/6" style={{ background: "rgba(139,92,246,0.08)" }} />
                      <div className="h-3 rounded-full animate-pulse w-3/4" style={{ background: "rgba(139,92,246,0.06)" }} />
                      <div className="h-2.5 rounded-full animate-pulse w-2/5 mt-4" style={{ background: "rgba(139,92,246,0.08)" }} />
                      <div className="h-2.5 rounded-full animate-pulse w-3/5" style={{ background: "rgba(139,92,246,0.06)" }} />
                    </div>
                  ) : aiInterpret && (
                    <div className="space-y-4">
                      {/* Summary */}
                      <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{aiInterpret.summary}</p>

                      {/* Findings */}
                      {aiInterpret.findings?.length > 0 && (
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: "#7c3aed" }}>Findings</p>
                          <ul className="space-y-1.5">
                            {aiInterpret.findings.map((f, i) => {
                              const warn = f.startsWith("⚠");
                              return (
                                <li key={i} className="flex items-start gap-2 text-[12px]">
                                  <span className={`shrink-0 text-[11px] font-bold mt-0.5 ${warn ? "text-amber-500" : "text-emerald-500"}`}>
                                    {warn ? "⚠" : "✓"}
                                  </span>
                                  <span className="text-[var(--text-secondary)]">{f.replace(/^[⚠✓]\s*/, "")}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {/* Recommendations */}
                      {aiInterpret.recommendations?.length > 0 && (
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: "#7c3aed" }}>Recommendations</p>
                          <ul className="space-y-1.5">
                            {aiInterpret.recommendations.map((r, i) => (
                              <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--text-secondary)]">
                                <span className="shrink-0 font-bold w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white mt-0.5"
                                  style={{ background: "linear-gradient(135deg, #60a5fa, #a78bfa)", minWidth: 16 }}>
                                  {i + 1}
                                </span>
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
