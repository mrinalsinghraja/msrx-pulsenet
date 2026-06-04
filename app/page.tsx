"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Download, Upload, Timer, Activity, Wifi, Zap,
  RefreshCw, TrendingUp, TrendingDown, MapPin,
  CheckCircle, XCircle, Globe, Clock,
} from "lucide-react";
import { scoreLabel } from "@/lib/score";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

type TestSession = {
  id: string; createdAt: string;
  download: number | null; upload: number | null;
  latency: number | null; jitter: number | null;
  packetLoss: number | null; score: number | null;
  isp: string | null; ip: string | null; location: string | null;
};

type IpInfo = { ip: string; isp: string; city: string; region: string; country: string; timezone: string };
type PingResult = { name: string; host: string; reachable: boolean; ms: number | null; loading: boolean };

const PING_TARGETS = [
  { name: "Google", host: "google.com" },
  { name: "Cloudflare", host: "cloudflare.com" },
  { name: "GitHub", host: "github.com" },
  { name: "Netflix", host: "netflix.com" },
  { name: "AWS", host: "aws.amazon.com" },
];

function timeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function fmtVal(val: number | null, digits = 1): string {
  if (val == null) return "—";
  return val >= 100 ? Math.round(val).toString() : val.toFixed(digits);
}

export default function Dashboard() {
  const router = useRouter();
  const [tests, setTests] = useState<TestSession[]>([]);
  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null);
  const [ipError, setIpError] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pings, setPings] = useState<PingResult[]>(
    PING_TARGETS.map((t) => ({ ...t, reachable: false, ms: null, loading: true }))
  );

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    // allSettled so one failure doesn't kill the other
    const [testsResult, ipResult] = await Promise.allSettled([
      fetch(`/api/tests?hours=168&_t=${Date.now()}`).then((r) => r.json()),
      fetch(`/api/ip-info?_t=${Date.now()}`).then((r) => r.json()),
    ]);

    if (testsResult.status === "fulfilled") {
      const t = testsResult.value;
      setTests(Array.isArray(t) ? t : []);
      setDbError(false);
    } else {
      setDbError(true);
    }

    if (ipResult.status === "fulfilled" && ipResult.value?.ip) {
      setIpInfo(ipResult.value);
      setIpError(false);
    } else {
      setIpError(true);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData();

    // Ping all targets in parallel (fire-and-forget)
    PING_TARGETS.forEach((target, idx) => {
      fetch(`/api/tools/ping?host=${target.host}`)
        .then((r) => r.json())
        .then((data) => {
          setPings((prev) => prev.map((p, i) =>
            i === idx ? { ...p, reachable: data.reachable, ms: data.ms, loading: false } : p
          ));
        })
        .catch(() => {
          setPings((prev) => prev.map((p, i) =>
            i === idx ? { ...p, reachable: false, ms: null, loading: false } : p
          ));
        });
    });
  }, [fetchData]);

  const latest = tests[0];
  const prev = tests[1];
  const chartData = [...tests].reverse().slice(-20).map((t, i) => ({
    i, dl: t.download, ul: t.upload,
  }));

  const reachableCount = pings.filter((p) => !p.loading && p.reachable).length;
  const allPingsLoaded = pings.every((p) => !p.loading);

  const latencyColor = (ms: number | null) => {
    if (ms == null) return "text-[var(--text-tertiary)]";
    if (ms <= 30) return "text-green-600";
    if (ms <= 80) return "text-amber-600";
    return "text-red-500";
  };

  const pingBarColor = (ms: number) =>
    ms < 100 ? "bg-green-400" : ms < 300 ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="p-6 max-w-4xl space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight leading-tight">Dashboard</h1>
          {ipInfo ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <MapPin size={11} className="text-[var(--text-tertiary)] shrink-0" />
              <p className="text-[12px] text-[var(--text-secondary)]">
                <span className="font-mono">{ipInfo.ip}</span>
                {" · "}{ipInfo.isp?.replace(/^AS\d+ /, "") || "—"}
                {" · "}{[ipInfo.city, ipInfo.country].filter(Boolean).join(", ")}
              </p>
            </div>
          ) : loading ? (
            <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">Detecting location…</p>
          ) : ipError ? (
            <p className="text-[12px] text-red-400 mt-0.5">Could not detect IP — check API</p>
          ) : null}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-white border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <RefreshCw size={15} className="animate-spin" />
          <span className="text-[13px]">Loading…</span>
        </div>
      ) : (
        <>
          {/* ── DB error banner ─────────────────────────────────────────── */}
          {dbError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-700 flex items-center gap-2">
              <XCircle size={14} className="shrink-0" />
              Database unreachable — speed test history unavailable. Connectivity data still live.
            </div>
          )}

          {/* ── Last Speed Test ──────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-[var(--border)]" style={{ boxShadow: "var(--shadow-card)" }}>
            {latest ? (() => {
              const { color: scoreColor, label: scoreLbl } = scoreLabel(latest.score ?? 0);
              const dl = latest.download;
              const ul = latest.upload;
              const lat = latest.latency;
              const jit = latest.jitter;
              const pkt = latest.packetLoss;
              const trend = (key: keyof TestSession, higher = true) => {
                const cur = latest[key] as number | null;
                const p = prev?.[key] as number | null;
                if (cur == null || p == null) return null;
                const diff = cur - p;
                const good = higher ? diff > 0 : diff < 0;
                return { diff, good };
              };
              return (
                <div>
                  {/* Card header */}
                  <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-50 to-violet-50 flex items-center justify-center">
                        <Zap size={15} className="text-violet-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-[14px] text-[var(--text-primary)]">Last Speed Test</p>
                        <p className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1">
                          <Clock size={9} />{timeAgo(latest.createdAt)}
                          {latest.location && ` · ${latest.location}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-[12px] font-bold border"
                        style={{ color: scoreColor, borderColor: scoreColor, background: `${scoreColor}15` }}>
                        {latest.score} / 100 · {scoreLbl}
                      </span>
                      <button
                        onClick={() => router.push("/speed-test")}
                        className="btn-primary py-1.5 px-3 text-[12px] flex items-center gap-1"
                      >
                        <Zap size={11} /> Retest
                      </button>
                    </div>
                  </div>

                  {/* Metrics row */}
                  <div className="grid grid-cols-5 divide-x divide-[var(--border)]">
                    {[
                      { label: "Download", value: fmtVal(dl), unit: "Mbps", icon: Download, iconCls: "text-cyan-500", valCls: "text-cyan-600", tr: trend("download", true) },
                      { label: "Upload", value: fmtVal(ul), unit: "Mbps", icon: Upload, iconCls: "text-violet-500", valCls: "text-violet-600", tr: trend("upload", true) },
                      { label: "Latency", value: fmtVal(lat), unit: "ms", icon: Timer, iconCls: "text-emerald-500", valCls: latencyColor(lat), tr: trend("latency", false) },
                      { label: "Jitter", value: fmtVal(jit), unit: "ms", icon: Activity, iconCls: "text-amber-500", valCls: "text-amber-600", tr: trend("jitter", false) },
                      { label: "Packet Loss", value: fmtVal(pkt), unit: "%", icon: Wifi, iconCls: "text-indigo-500", valCls: pkt === 0 ? "text-green-600" : pkt != null && pkt < 2 ? "text-amber-600" : "text-red-500", tr: trend("packetLoss", false) },
                    ].map(({ label, value, unit, icon: Icon, iconCls, valCls, tr }) => (
                      <div key={label} className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1.5">
                          <Icon size={12} className={iconCls} />
                          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium">{label}</p>
                        </div>
                        <p className={`text-[22px] font-black leading-none ${valCls}`}>{value}</p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <p className="text-[10px] text-[var(--text-tertiary)]">{unit}</p>
                          {tr && (
                            <span className={`text-[9px] font-semibold flex items-center gap-0.5 ${tr.good ? "text-green-500" : "text-red-400"}`}>
                              {tr.good ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                              {Math.abs(tr.diff).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Trend chart */}
                  {chartData.length >= 2 && (
                    <div className="px-5 pb-5 border-t border-[var(--border)] pt-4">
                      <div className="flex items-center gap-4 mb-3">
                        <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Bandwidth Trend · last {chartData.length} tests</p>
                        <div className="flex items-center gap-3 ml-auto">
                          <span className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />Download</span>
                          <span className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />Upload</span>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={80}>
                        <AreaChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="dlg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="ulg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="dl" stroke="#22d3ee" strokeWidth={2} fill="url(#dlg)" dot={false} isAnimationActive={false} name="dl" />
                          <Area type="monotone" dataKey="ul" stroke="#a855f7" strokeWidth={2} fill="url(#ulg)" dot={false} isAnimationActive={false} name="ul" />
                          <Tooltip
                            contentStyle={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 11 }}
                            formatter={(v, n) => [`${v} Mbps`, n === "dl" ? "Download" : "Upload"]}
                            labelFormatter={() => ""}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="py-12 flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 flex items-center justify-center">
                  <Zap size={26} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--text-primary)]">No speed test data yet</p>
                  <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">Run your first test to see network health here</p>
                </div>
                <button onClick={() => router.push("/speed-test")} className="btn-primary flex items-center gap-2 mt-1">
                  <Zap size={13} /> Run Speed Test
                </button>
              </div>
            )}
          </div>

          {/* ── Row 2: Connectivity + Stats ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Connectivity */}
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Globe size={13} className="text-[var(--text-tertiary)]" />
                  <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Internet Connectivity</p>
                </div>
                {allPingsLoaded && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    reachableCount === 5 ? "bg-green-100 text-green-700" :
                    reachableCount >= 3 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  }`}>
                    {reachableCount}/{PING_TARGETS.length} up
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {pings.map((p) => (
                  <div key={p.host} className="flex items-center gap-2.5">
                    {p.loading ? (
                      <RefreshCw size={12} className="text-[var(--text-tertiary)] animate-spin shrink-0" />
                    ) : p.reachable ? (
                      <CheckCircle size={12} className="text-green-500 shrink-0" />
                    ) : (
                      <XCircle size={12} className="text-red-400 shrink-0" />
                    )}
                    <span className="text-[13px] text-[var(--text-primary)] font-medium flex-1 min-w-0">{p.name}</span>
                    <span className={`text-[11px] font-mono min-w-[44px] text-right ${p.loading ? "text-[var(--text-tertiary)]" : p.reachable ? latencyColor(p.ms) : "text-[var(--text-tertiary)]"}`}>
                      {p.loading ? "…" : p.reachable ? `${p.ms}ms` : "—"}
                    </span>
                    <div className="w-20 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden shrink-0">
                      {!p.loading && p.reachable && p.ms != null && (
                        <div className={`h-full rounded-full ${pingBarColor(p.ms)}`} style={{ width: `${Math.min(100, (p.ms / 500) * 100)}%` }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 24h Summary stats */}
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Activity size={13} className="text-[var(--text-tertiary)]" />
                <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">7-Day Summary</p>
              </div>
              {tests.length > 0 ? (() => {
                const avgDl = tests.reduce((a, t) => a + (t.download ?? 0), 0) / tests.filter(t => t.download != null).length;
                const avgUl = tests.reduce((a, t) => a + (t.upload ?? 0), 0) / tests.filter(t => t.upload != null).length;
                const avgLat = tests.reduce((a, t) => a + (t.latency ?? 0), 0) / tests.filter(t => t.latency != null).length;
                const avgScore = tests.reduce((a, t) => a + (t.score ?? 0), 0) / tests.filter(t => t.score != null).length;
                const { color: sc } = scoreLabel(Math.round(avgScore));
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Tests Run", value: tests.length.toString(), color: "text-[var(--text-primary)]" },
                        { label: "Avg Score", value: Math.round(avgScore).toString(), color: "", style: { color: sc } },
                        { label: "Avg Download", value: `${fmtVal(avgDl)} Mbps`, color: "text-cyan-600" },
                        { label: "Avg Upload", value: `${fmtVal(avgUl)} Mbps`, color: "text-violet-600" },
                        { label: "Avg Latency", value: `${fmtVal(avgLat)} ms`, color: latencyColor(avgLat) },
                        { label: "Last Tested", value: timeAgo(tests[0]?.createdAt), color: "text-[var(--text-secondary)]" },
                      ].map(({ label, value, color, style }) => (
                        <div key={label}>
                          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-0.5">{label}</p>
                          <p className={`text-[15px] font-bold ${color}`} style={style}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })() : (
                <div className="py-6 text-center">
                  <p className="text-[13px] text-[var(--text-secondary)]">No tests in last 7 days</p>
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">Stats appear after first test</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
