"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Download, Upload, Timer, Activity, Wifi, Zap,
  RefreshCw, TrendingUp, TrendingDown, MapPin,
  CheckCircle, XCircle, Globe, Clock, Monitor,
  Gamepad2, Video, Radio, Sparkles,
} from "lucide-react";
import { scoreLabel } from "@/lib/score";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { MetricExplainer } from "@/app/components/MetricExplainer";
import { DownloadButton } from "@/app/components/DownloadButton";

// ── Types ─────────────────────────────────────────────────────────────────────
type Test = {
  id: string; createdAt: string;
  download: number | null; upload: number | null;
  latency: number | null; jitter: number | null;
  packetLoss: number | null; score: number | null;
  isp: string | null; ip: string | null; location: string | null;
};

type IpInfo = { ip: string; isp: string; city: string; region: string; country: string; timezone: string };
type Ping = { name: string; host: string; reachable: boolean; ms: number | null; loading: boolean };

const PING_TARGETS = [
  { name: "Google", host: "google.com" },
  { name: "Cloudflare", host: "cloudflare.com" },
  { name: "GitHub", host: "github.com" },
  { name: "Netflix", host: "netflix.com" },
  { name: "AWS", host: "aws.amazon.com" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmt(v: number | null, d = 1) {
  if (v == null) return "—";
  return v >= 100 ? Math.round(v).toString() : v.toFixed(d);
}

function latCls(ms: number | null) {
  if (!ms) return "text-[var(--text-tertiary)]";
  return ms <= 30 ? "text-emerald-600" : ms <= 80 ? "text-amber-600" : "text-red-500";
}

// ── Use-case rating ───────────────────────────────────────────────────────────
type UseCase = { label: string; sublabel: string; icon: React.ElementType; ok: boolean; reason: string };

function getUseCases(t: Test): UseCase[] {
  const dl = t.download ?? 0;
  const ul = t.upload ?? 0;
  const lat = t.latency ?? 999;
  const jit = t.jitter ?? 999;
  const pkt = t.packetLoss ?? 100;

  return [
    {
      label: "4K Streaming",
      sublabel: "Netflix / YouTube",
      icon: Monitor,
      ok: dl >= 25 && lat < 80,
      reason: dl < 25 ? `Need 25 Mbps DL (have ${fmt(dl)})` : "Latency too high",
    },
    {
      label: "Online Gaming",
      sublabel: "Low latency required",
      icon: Gamepad2,
      ok: lat <= 30 && jit <= 5 && pkt <= 0.5,
      reason: lat > 30 ? `Latency ${fmt(lat)}ms (need ≤30ms)` : jit > 5 ? `Jitter too high (${fmt(jit)}ms)` : "Packet loss too high",
    },
    {
      label: "HD Video Calls",
      sublabel: "Teams / Zoom / Meet",
      icon: Video,
      ok: dl >= 5 && ul >= 2 && lat < 80 && pkt < 1,
      reason: ul < 2 ? `Need 2 Mbps UL (have ${fmt(ul)})` : "Latency or packet loss issue",
    },
    {
      label: "4K Video Calls",
      sublabel: "Ultra-HD quality",
      icon: Radio,
      ok: dl >= 25 && ul >= 10 && lat <= 40 && pkt === 0,
      reason: ul < 10 ? `Need 10 Mbps UL (have ${fmt(ul)})` : "Check latency/jitter",
    },
  ];
}

// ── Mini gauge (ring) ─────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const { color, label } = scoreLabel(score);
  const r = 42, circ = 2 * Math.PI * r;
  const progress = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center w-28 h-28 shrink-0">
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={r} fill="none" stroke="#f0f0f3" strokeWidth="10" />
        <circle cx="56" cy="56" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={`${progress} ${circ}`}
          strokeDashoffset={circ * 0.25} style={{ transition: "stroke-dasharray 0.7s ease" }} />
      </svg>
      <div className="absolute text-center">
        <p className="text-[24px] font-black text-[var(--text-primary)] leading-none">{score}</p>
        <p className="text-[10px] font-bold mt-0.5" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [ip, setIp] = useState<IpInfo | null>(null);
  const [ipErr, setIpErr] = useState(false);
  const [dbErr, setDbErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pings, setPings] = useState<Ping[]>(PING_TARGETS.map((t) => ({ ...t, reachable: false, ms: null, loading: true })));
  const [explainer, setExplainer] = useState<{ name: string; value: string | number; unit: string; color: string; context?: string } | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiInsightLoading, setAiInsightLoading] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const [testsRes, ipRes] = await Promise.allSettled([
      fetch(`/api/tests?hours=168&_t=${Date.now()}`).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "DB error");
        return d;
      }),
      fetch(`/api/ip-info?_t=${Date.now()}`).then((r) => r.json()),
    ]);

    if (testsRes.status === "fulfilled") {
      setTests(Array.isArray(testsRes.value) ? testsRes.value : []);
      setDbErr("");
    } else {
      setDbErr(testsRes.reason?.message || "Database error");
    }

    if (ipRes.status === "fulfilled" && ipRes.value?.ip) {
      setIp(ipRes.value);
      setIpErr(false);
    } else {
      setIpErr(true);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData();
    PING_TARGETS.forEach((target, idx) => {
      fetch(`/api/tools/ping?host=${target.host}`)
        .then((r) => r.json())
        .then((d) => setPings((p) => p.map((x, i) => i === idx ? { ...x, reachable: d.reachable, ms: d.ms, loading: false } : x)))
        .catch(() => setPings((p) => p.map((x, i) => i === idx ? { ...x, reachable: false, ms: null, loading: false } : x)));
    });
  }, [fetchData]);

  const latest = tests[0];
  const prev = tests[1];

  // Fetch AI insight for latest test (cached by test ID in sessionStorage)
  useEffect(() => {
    if (!latest) return;
    const cacheKey = `pn_ai_insight_${latest.id}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { setAiInsight(cached); return; }
    if (!latest.download || !latest.upload || !latest.latency) return;
    setAiInsightLoading(true);
    setAiInsight(null);
    fetch("/api/ai/speed-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        download: latest.download, upload: latest.upload,
        latency: latest.latency, jitter: latest.jitter ?? 0,
        packetLoss: latest.packetLoss ?? 0, score: latest.score ?? 0,
      }),
    })
      .then(r => r.json())
      .then(data => {
        const txt = data.summary ?? "";
        if (txt) sessionStorage.setItem(cacheKey, txt);
        setAiInsight(txt);
        setAiInsightLoading(false);
      })
      .catch(() => setAiInsightLoading(false));
  }, [latest?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const chartData = [...tests].reverse().slice(-20).map((t, i) => ({ i, dl: t.download, ul: t.upload, lat: t.latency }));
  const reachable = pings.filter((p) => !p.loading && p.reachable).length;
  const allLoaded = pings.every((p) => !p.loading);
  const useCases = latest ? getUseCases(latest) : null;

  // 7-day averages
  const withDl = tests.filter((t) => t.download != null);
  const withUl = tests.filter((t) => t.upload != null);
  const withLat = tests.filter((t) => t.latency != null);
  const avgDl = withDl.length ? withDl.reduce((a, t) => a + t.download!, 0) / withDl.length : null;
  const avgUl = withUl.length ? withUl.reduce((a, t) => a + t.upload!, 0) / withUl.length : null;
  const avgLat = withLat.length ? withLat.reduce((a, t) => a + t.latency!, 0) / withLat.length : null;
  const avgScore = tests.filter((t) => t.score != null).reduce((a, t) => a + t.score!, 0) / Math.max(tests.filter((t) => t.score != null).length, 1);

  const card = "bg-white rounded-2xl border border-[var(--border)]";
  const cardStyle = { boxShadow: "var(--shadow-card)" };
  const sectionLabel = "text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-3";

  return (
    <div className="p-6 max-w-4xl space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight leading-tight">Dashboard</h1>
          {ip ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <MapPin size={11} className="text-[var(--text-tertiary)]" />
              <p className="text-[12px] text-[var(--text-secondary)]">
                <span className="font-mono font-medium">{ip.ip}</span>
                {" · "}<span>{ip.isp?.replace(/^AS\d+ /, "")}</span>
                {" · "}<span>{[ip.city, ip.country].filter(Boolean).join(", ")}</span>
              </p>
            </div>
          ) : loading ? (
            <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5 flex items-center gap-1">
              <RefreshCw size={10} className="animate-spin" /> Detecting…
            </p>
          ) : ipErr ? (
            <p className="text-[12px] text-red-400 mt-0.5">IP detection failed</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0 pn-no-print">
          {!loading && <DownloadButton targetId="dashboard-report" filename="pulsenet-dashboard" label="Export" />}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-white border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>
      {explainer && (
        <MetricExplainer metric={explainer} onClose={() => setExplainer(null)} />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-tertiary)] py-8">
          <RefreshCw size={15} className="animate-spin" />
          <span className="text-[13px]">Loading dashboard…</span>
        </div>
      ) : (
        <div id="dashboard-report">
          {dbErr && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-700 flex gap-2">
              <XCircle size={14} className="shrink-0 mt-0.5" />
              <span>Database error: {dbErr}. Speed test history unavailable.</span>
            </div>
          )}

          {/* ── Section 1: Score + Last Test ───────────────────────────────── */}
          {latest ? (
            <div className={`${card} overflow-hidden`} style={cardStyle}>
              {/* Top: score + metrics */}
              <div className="p-5 flex flex-col sm:flex-row gap-5">
                {/* Score ring */}
                <div className="flex flex-col items-center gap-2">
                  <ScoreRing score={latest.score ?? 0} />
                  <p className="text-[11px] text-[var(--text-tertiary)] text-center">Network Score</p>
                </div>

                {/* Metrics 5-column */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <p className={sectionLabel} style={{ marginBottom: 0 }}>Last Speed Test</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1">
                        <Clock size={10} />{timeAgo(latest.createdAt)}
                        {latest.location && ` · ${latest.location}`}
                      </p>
                      <button onClick={() => router.push("/speed-test")} className="btn-primary py-1 px-2.5 text-[11px] flex items-center gap-1">
                        <Zap size={10} /> Retest
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-1 px-1">
                  <div className="grid grid-cols-5 gap-2" style={{ minWidth: 300 }}>
                    {[
                      { label: "Download Speed", val: latest.download, unit: "Mbps", icon: Download, cls: "text-cyan-600", bg: "bg-cyan-50", prev: prev?.download, higher: true, rgb: "34,211,238", ctx: "Higher is better. Measured using 25MB Cloudflare CDN blob." },
                      { label: "Upload Speed", val: latest.upload, unit: "Mbps", icon: Upload, cls: "text-violet-600", bg: "bg-violet-50", prev: prev?.upload, higher: true, rgb: "168,85,247", ctx: "Higher is better. Measured via 4 concurrent XHR uploads to Cloudflare." },
                      { label: "Latency", val: latest.latency, unit: "ms", icon: Timer, cls: latCls(latest.latency), bg: "bg-emerald-50", prev: prev?.latency, higher: false, rgb: "16,185,129", ctx: "Round-trip time to Cloudflare. Lower is better. Under 30ms is excellent." },
                      { label: "Jitter", val: latest.jitter, unit: "ms", icon: Activity, cls: "text-amber-600", bg: "bg-amber-50", prev: prev?.jitter, higher: false, rgb: "245,158,11", ctx: "Variance in latency between packets. Under 5ms is excellent for gaming and calls." },
                      { label: "Packet Loss", val: latest.packetLoss, unit: "%", icon: Wifi, cls: (latest.packetLoss ?? 0) === 0 ? "text-green-600" : "text-red-500", bg: "bg-indigo-50", prev: prev?.packetLoss, higher: false, rgb: "99,102,241", ctx: "Percentage of packets lost in transit. 0% is ideal. Above 1% causes noticeable issues." },
                    ].map(({ label, val, unit, icon: Icon, cls, bg, prev: p, higher, rgb, ctx }) => {
                      const diff = val != null && p != null ? val - p : null;
                      const good = diff != null ? (higher ? diff > 0 : diff < 0) : null;
                      return (
                        <button
                          key={label}
                          onClick={() => val != null && setExplainer({ name: label, value: fmt(val), unit, color: rgb, context: ctx })}
                          className={`${bg} rounded-xl p-2.5 flex flex-col items-center gap-1 cursor-pointer hover:brightness-95 transition-all active:scale-95 text-left w-full`}
                          title="Click for AI analysis"
                        >
                          <Icon size={12} className={cls} />
                          <p className={`text-[20px] font-black leading-none ${cls}`}>{fmt(val)}</p>
                          <p className="text-[9px] text-[var(--text-tertiary)] font-medium">{unit}</p>
                          <p className="text-[9px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wide leading-tight text-center">{label.split(" ")[0]}</p>
                          {good != null && (
                            <span className={`text-[8px] font-bold flex items-center gap-0.5 ${good ? "text-green-500" : "text-red-400"}`}>
                              {good ? <TrendingUp size={8} /> : <TrendingDown size={8} />}{Math.abs(diff!).toFixed(1)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  </div>
                </div>
              </div>

              {/* AI Insight strip */}
              {(aiInsightLoading || aiInsight) && (
                <div className="px-5 py-3 border-t border-[var(--border)] flex items-start gap-2.5"
                  style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.03) 0%, rgba(34,211,238,0.03) 100%)" }}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #22d3ee 100%)" }}>
                    <Sparkles size={9} className="text-white" />
                  </div>
                  {aiInsightLoading ? (
                    <div className="flex-1 space-y-1.5 py-0.5">
                      <div className="h-2.5 rounded-full bg-[var(--surface)] animate-pulse w-full" />
                      <div className="h-2.5 rounded-full bg-[var(--surface)] animate-pulse w-4/5" />
                    </div>
                  ) : (
                    <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed flex-1">{aiInsight}</p>
                  )}
                  <span className="text-[9px] font-semibold shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(139,92,246,0.08)", color: "#8b5cf6" }}>AI</span>
                </div>
              )}

              {/* Use-case ratings */}
              {useCases && (
                <div className="px-5 pb-5 border-t border-[var(--border)] pt-4">
                  <p className={sectionLabel}>Connection Suitability</p>
                  {/* 2-col on mobile, 4-col on sm+ */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {useCases.map(({ label, sublabel, icon: Icon, ok, reason }) => (
                      <div key={label} className={`rounded-xl p-2.5 border flex flex-col gap-1.5 ${ok ? "bg-green-50 border-green-100" : "bg-[var(--surface)] border-[var(--border)]"}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${ok ? "bg-green-100" : "bg-gray-100"}`}>
                            <Icon size={12} className={ok ? "text-green-600" : "text-[var(--text-tertiary)]"} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[11px] font-bold leading-tight ${ok ? "text-green-700" : "text-[var(--text-secondary)]"}`}>{label}</p>
                            <p className="text-[9px] text-[var(--text-tertiary)] leading-tight truncate">{sublabel}</p>
                          </div>
                        </div>
                        <div className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full w-fit ${ok ? "bg-green-200 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                          {ok ? "✓ Ready" : "Limited"}
                        </div>
                        {!ok && <p className="text-[9px] text-[var(--text-tertiary)] leading-tight">{reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trend chart */}
              {chartData.length >= 2 && (
                <div className="px-5 pb-5 border-t border-[var(--border)] pt-4">
                  <div className="flex items-center gap-3 mb-2">
                    <p className={sectionLabel} style={{ marginBottom: 0 }}>Bandwidth History · {chartData.length} tests</p>
                    <div className="flex gap-3 ml-auto">
                      {[{ label: "DL", color: "#22d3ee" }, { label: "UL", color: "#a855f7" }].map(({ label, color }) => (
                        <span key={label} className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />{label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={72}>
                    <AreaChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="gdl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gul" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="dl" stroke="#22d3ee" strokeWidth={1.5} fill="url(#gdl)" dot={false} isAnimationActive={false} />
                      <Area type="monotone" dataKey="ul" stroke="#a855f7" strokeWidth={1.5} fill="url(#gul)" dot={false} isAnimationActive={false} />
                      <Tooltip contentStyle={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 11 }}
                        formatter={(v, n) => [`${v} Mbps`, n === "dl" ? "Download" : "Upload"]} labelFormatter={() => ""} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            /* No data empty state */
            <div className={`${card} py-14 flex flex-col items-center text-center gap-3`} style={cardStyle}>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 flex items-center justify-center">
                <Zap size={26} className="text-violet-400" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">No speed test data yet</p>
                <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">Run your first test to see network health and use-case ratings</p>
              </div>
              <button onClick={() => router.push("/speed-test")} className="btn-primary flex items-center gap-2 mt-1">
                <Zap size={13} /> Run Speed Test
              </button>
            </div>
          )}

          {/* ── Section 2: Connectivity + 7-day Summary ────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Connectivity */}
            <div className={`${card} p-5`} style={cardStyle}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Globe size={13} className="text-[var(--text-tertiary)]" />
                  <p className={sectionLabel} style={{ marginBottom: 0 }}>Internet Connectivity</p>
                </div>
                {allLoaded && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${reachable === 5 ? "bg-green-100 text-green-700" : reachable >= 3 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                    {reachable}/{PING_TARGETS.length} up
                  </span>
                )}
              </div>
              <div className="space-y-2.5">
                {pings.map((p) => (
                  <div key={p.host} className="flex items-center gap-2.5">
                    {p.loading
                      ? <RefreshCw size={12} className="text-[var(--text-tertiary)] animate-spin shrink-0" />
                      : p.reachable
                        ? <CheckCircle size={12} className="text-green-500 shrink-0" />
                        : <XCircle size={12} className="text-red-400 shrink-0" />}
                    <span className="text-[13px] font-medium text-[var(--text-primary)] flex-1">{p.name}</span>
                    <span className={`text-[11px] font-mono w-12 text-right ${p.loading ? "text-[var(--text-tertiary)]" : latCls(p.ms)}`}>
                      {p.loading ? "…" : p.reachable ? `${p.ms}ms` : "—"}
                    </span>
                    <div className="w-20 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden shrink-0">
                      {!p.loading && p.reachable && p.ms != null && (
                        <div className={`h-full rounded-full ${p.ms < 100 ? "bg-green-400" : p.ms < 300 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${Math.min(100, (p.ms / 500) * 100)}%` }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 7-day summary */}
            <div className={`${card} p-5`} style={cardStyle}>
              <div className="flex items-center gap-2 mb-4">
                <Activity size={13} className="text-[var(--text-tertiary)]" />
                <p className={sectionLabel} style={{ marginBottom: 0 }}>7-Day Performance</p>
              </div>
              {tests.length > 0 ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  {[
                    { label: "Tests Run", value: `${tests.length}`, sub: "last 7 days", cls: "text-[var(--text-primary)]" },
                    { label: "Avg Score", value: Math.round(avgScore).toString(), sub: scoreLabel(Math.round(avgScore)).label, cls: "", style: { color: scoreLabel(Math.round(avgScore)).color } },
                    { label: "Avg Download", value: `${fmt(avgDl)} Mbps`, sub: "combined avg", cls: "text-cyan-600" },
                    { label: "Avg Upload", value: `${fmt(avgUl)} Mbps`, sub: "combined avg", cls: "text-violet-600" },
                    { label: "Avg Latency", value: `${fmt(avgLat)} ms`, sub: avgLat != null && avgLat <= 30 ? "Excellent" : avgLat != null && avgLat <= 60 ? "Good" : "Check connection", cls: latCls(avgLat) },
                    { label: "Last Tested", value: timeAgo(tests[0].createdAt), sub: tests[0].location ?? "—", cls: "text-[var(--text-secondary)]" },
                  ].map(({ label, value, sub, cls, style }) => (
                    <div key={label}>
                      <p className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold mb-0.5">{label}</p>
                      <p className={`text-[16px] font-black leading-tight ${cls}`} style={style}>{value}</p>
                      <p className="text-[10px] text-[var(--text-tertiary)]">{sub}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-[13px] text-[var(--text-secondary)]">No tests yet</p>
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">Stats appear after first test</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
