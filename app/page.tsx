"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Download, Upload, Timer, Activity, Wifi, Zap,
  ArrowRight, RefreshCw, TrendingUp, TrendingDown, Globe
} from "lucide-react";
import { scoreLabel } from "@/lib/score";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

type TestSession = {
  id: string;
  createdAt: string;
  download: number | null;
  upload: number | null;
  latency: number | null;
  jitter: number | null;
  packetLoss: number | null;
  score: number | null;
  isp: string | null;
};

type IpInfo = { ip: string; isp: string; city: string; country: string };

function MiniGauge({ score }: { score: number }) {
  const { color, label } = scoreLabel(score);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const progress = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#f0f0f3" strokeWidth="9" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${progress} ${circ}`} strokeDashoffset={circ * 0.25}
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
      <div className="absolute text-center">
        <p className="text-[20px] font-bold text-[var(--text-primary)] leading-none">{score}</p>
        <p className="text-[9px] font-semibold" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}

function StatChip({
  icon: Icon, label, value, unit, prev
}: { icon: React.ElementType; label: string; value: number | null; unit: string; prev?: number | null }) {
  const trend = prev != null && value != null ? value - prev : null;
  const trendUp = label === "Download" || label === "Upload" ? trend && trend > 0 : trend && trend < 0;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[var(--border)] last:border-b-0">
      <div className="w-8 h-8 rounded-xl bg-[var(--surface)] flex items-center justify-center shrink-0">
        <Icon size={14} className="text-[var(--text-tertiary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[var(--text-tertiary)]">{label}</p>
        <p className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
          {value != null ? value : "—"} <span className="text-[11px] font-normal text-[var(--text-tertiary)]">{unit}</span>
        </p>
      </div>
      {trend != null && (
        <div className={`flex items-center gap-0.5 text-[11px] font-medium ${trendUp ? "text-green-500" : "text-red-400"}`}>
          {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {Math.abs(trend).toFixed(1)}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [tests, setTests] = useState<TestSession[]>([]);
  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/tests?hours=24").then((r) => r.json()),
      fetch("/api/ip-info").then((r) => r.json()),
    ]).then(([t, ip]) => {
      setTests(t);
      setIpInfo(ip);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const latest = tests[0];
  const prev = tests[1];

  const chartData = [...tests].reverse().slice(-20).map((t, i) => ({
    i,
    dl: t.download,
    ul: t.upload,
    lat: t.latency,
  }));

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight mb-0.5">Dashboard</h1>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Network health overview · {ipInfo ? `${ipInfo.city}, ${ipInfo.country}` : "Detecting location…"}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-[13px]">Loading…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: gauge + run test */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5 flex flex-col items-center" style={{ boxShadow: "var(--shadow-card)" }}>
              {latest?.score != null ? (
                <>
                  <MiniGauge score={latest.score} />
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-2 text-center">Network Health Score</p>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                    {new Date(latest.createdAt).toLocaleString()}
                  </p>
                </>
              ) : (
                <div className="py-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] flex items-center justify-center mx-auto mb-3">
                    <Zap size={24} className="text-[var(--text-tertiary)]" />
                  </div>
                  <p className="text-[13px] font-medium text-[var(--text-primary)] mb-1">No test data</p>
                  <p className="text-[12px] text-[var(--text-secondary)]">Run a speed test to see results</p>
                </div>
              )}
              <button
                onClick={() => router.push("/speed-test")}
                className="mt-4 btn-primary w-full flex items-center justify-center gap-1.5 py-2.5"
              >
                <Zap size={13} />
                Run Speed Test
              </button>
            </div>

            {/* ISP Card */}
            {ipInfo && (
              <div className="mt-4 bg-white rounded-2xl border border-[var(--border)] p-4" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={13} className="text-[var(--text-tertiary)]" />
                  <p className="text-[11px] font-semibold text-[var(--text-tertiary)] tracking-wide uppercase">Connection</p>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "IP Address", value: ipInfo.ip },
                    { label: "ISP", value: ipInfo.isp?.replace(/^AS\d+ /, "") || "—" },
                    { label: "Location", value: [ipInfo.city, ipInfo.country].filter(Boolean).join(", ") || "—" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] text-[var(--text-tertiary)]">{label}</p>
                      <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: metrics + chart */}
          <div className="lg:col-span-2 space-y-4">
            {/* Latest metrics */}
            <div className="bg-white rounded-2xl border border-[var(--border)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
              <p className="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">
                Latest Results
              </p>
              {latest ? (
                <div>
                  <StatChip icon={Download} label="Download" value={latest.download} unit="Mbps" prev={prev?.download} />
                  <StatChip icon={Upload} label="Upload" value={latest.upload} unit="Mbps" prev={prev?.upload} />
                  <StatChip icon={Timer} label="Latency" value={latest.latency} unit="ms" prev={prev?.latency} />
                  <StatChip icon={Activity} label="Jitter" value={latest.jitter} unit="ms" prev={prev?.jitter} />
                  <StatChip icon={Wifi} label="Packet Loss" value={latest.packetLoss} unit="%" prev={prev?.packetLoss} />
                </div>
              ) : (
                <p className="text-[13px] text-[var(--text-secondary)] py-4 text-center">No tests yet</p>
              )}
            </div>

            {/* Trend charts */}
            {chartData.length >= 3 && (
              <div className="bg-white rounded-2xl border border-[var(--border)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Bandwidth Trend</p>
                  <button
                    onClick={() => router.push("/history")}
                    className="flex items-center gap-1 text-[12px] text-[#7C3AED] hover:opacity-75 transition-opacity"
                  >
                    Full history <ArrowRight size={11} />
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="dlg-dash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ulg-dash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="dl" stroke="#60a5fa" strokeWidth={2} fill="url(#dlg-dash)" dot={false} isAnimationActive={false} name="Download" />
                    <Area type="monotone" dataKey="ul" stroke="#a78bfa" strokeWidth={2} fill="url(#ulg-dash)" dot={false} isAnimationActive={false} name="Upload" />
                    <Tooltip
                      contentStyle={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number, name: string) => [`${v} Mbps`, name === "dl" ? "Download" : "Upload"]}
                      labelFormatter={() => ""}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
