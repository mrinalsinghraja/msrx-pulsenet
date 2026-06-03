"use client";

import { useState, useEffect } from "react";
import { Globe, Search, Loader2, Clock, MapPin } from "lucide-react";

type DnsResult = {
  id: string;
  domain: string;
  ip: string | null;
  country: string | null;
  flag: string | null;
  category: string | null;
  dnsMs: number | null;
  org: string | null;
  createdAt: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  CDN: "bg-blue-100 text-blue-700",
  Cloud: "bg-violet-100 text-violet-700",
  Search: "bg-amber-100 text-amber-700",
  "Social Media": "bg-pink-100 text-pink-700",
  Streaming: "bg-red-100 text-red-700",
  Knowledge: "bg-green-100 text-green-700",
  Unknown: "bg-gray-100 text-gray-600",
};

const QUICK_DOMAINS = [
  "google.com", "cloudflare.com", "github.com",
  "stackoverflow.com", "amazon.com", "netflix.com",
];

export default function ConnectionsPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<DnsResult[]>([]);

  useEffect(() => {
    // Load recent lookups on mount
    // We don't have a GET /api/dns/lookup endpoint for history, so skip for now
  }, []);

  async function lookup(domain: string) {
    const d = domain.trim().replace(/^https?:\/\//, "").split("/")[0];
    if (!d) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dns/lookup?domain=${encodeURIComponent(d)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults((prev) => [data, ...prev.filter((r) => r.domain !== data.domain)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    lookup(query);
  }

  const totalDomains = results.length;
  const avgDns = results.length
    ? Math.round(results.reduce((a, r) => a + (r.dnsMs ?? 0), 0) / results.length * 10) / 10
    : null;
  const countries = new Set(results.map((r) => r.country).filter(Boolean)).size;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Globe size={18} className="text-[var(--text-secondary)]" />
          <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight">Connection Intelligence</h1>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)]">DNS timing, IP resolution, geolocation & domain analysis</p>
      </div>

      {/* Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Domains Analyzed", value: totalDomains },
            { label: "Avg DNS Time", value: avgDns != null ? `${avgDns} ms` : "—" },
            { label: "Countries", value: countries },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-2xl p-4 border border-[var(--border)] text-center" style={{ boxShadow: "var(--shadow-card)" }}>
              <p className="text-[11px] text-[var(--text-tertiary)] mb-1">{label}</p>
              <p className="text-[20px] font-bold text-[var(--text-primary)]">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter domain to analyze…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border-strong)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all bg-white"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="btn-primary px-5 flex items-center gap-2"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : "Resolve"}
        </button>
      </form>

      {/* Quick domains */}
      <div className="flex flex-wrap gap-2 mb-5">
        {QUICK_DOMAINS.map((d) => (
          <button
            key={d}
            onClick={() => { setQuery(d); lookup(d); }}
            className="px-3 py-1 rounded-full text-[12px] bg-white border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
          >
            {d}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600">{error}</div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          {results.map((r, i) => (
            <div
              key={r.id}
              className={`flex items-center gap-4 px-5 py-3.5 ${i < results.length - 1 ? "border-b border-[var(--border)]" : ""}`}
            >
              <span className="text-[22px] w-7 text-center shrink-0">{r.flag ?? "🌐"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[14px] text-[var(--text-primary)]">{r.domain}</p>
                  {r.category && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[r.category] ?? CATEGORY_COLORS.Unknown}`}>
                      {r.category}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[12px] text-[var(--text-secondary)] font-mono">{r.ip ?? "—"}</span>
                  {r.country && (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                      <MapPin size={10} /> {r.country}
                    </span>
                  )}
                  {r.org && (
                    <span className="text-[11px] text-[var(--text-tertiary)] truncate">{r.org.replace(/^AS\d+ /, "")}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">{r.dnsMs != null ? r.dnsMs.toFixed(1) : "—"}</p>
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] justify-end">
                  <Clock size={9} /> DNS ms
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !loading && (
        <div className="text-center py-16">
          <Globe size={32} className="text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-[14px] font-medium text-[var(--text-primary)] mb-1">No lookups yet</p>
          <p className="text-[13px] text-[var(--text-secondary)]">Enter a domain or click a quick link above.</p>
        </div>
      )}
    </div>
  );
}
