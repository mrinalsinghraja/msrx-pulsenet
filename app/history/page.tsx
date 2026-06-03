"use client";

import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import { History, Download, Upload, Timer, Activity, Zap } from "lucide-react";
import { scoreLabel } from "@/lib/score";

type TestSession = {
  id: string;
  createdAt: string;
  download: number | null;
  upload: number | null;
  latency: number | null;
  jitter: number | null;
  packetLoss: number | null;
  score: number | null;
};

const RANGES = [
  { label: "1H", hours: 1 },
  { label: "6H", hours: 6 },
  { label: "24H", hours: 24 },
  { label: "7D", hours: 168 },
];

function avg(arr: (number | null)[]): string {
  const valid = arr.filter((v): v is number => v != null);
  if (!valid.length) return "—";
  return (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1);
}

export default function HistoryPage() {
  const [hours, setHours] = useState(24);
  const [tests, setTests] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tests?hours=${hours}`)
      .then((r) => r.json())
      .then((d) => { setTests(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [hours]);

  const chartData = [...tests].reverse().map((t) => ({
    time: new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    dl: t.download,
    ul: t.upload,
    lat: t.latency,
    jitter: t.jitter,
    score: t.score,
  }));

  const statCards = [
    { label: "Avg Download", icon: Download, value: avg(tests.map((t) => t.download)), unit: "Mbps", color: "#3b82f6" },
    { label: "Avg Upload", icon: Upload, value: avg(tests.map((t) => t.upload)), unit: "Mbps", color: "#8b5cf6" },
    { label: "Avg Latency", icon: Timer, value: avg(tests.map((t) => t.latency)), unit: "ms", color: "#16a34a" },
    { label: "Avg Jitter", icon: Activity, value: avg(tests.map((t) => t.jitter)), unit: "ms", color: "#d97706" },
    { label: "Tests Run", icon: Zap, value: String(tests.length), unit: "", color: "#6366f1" },
    {
      label: "Avg Score",
      icon: Zap,
      value: avg(tests.map((t) => t.score)),
      unit: "/ 100",
      color: tests.length ? scoreLabel(Number(avg(tests.map((t) => t.score)))).color : "#a1a1a6",
    },
  ];

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <History size={18} className="text-[var(--text-secondary)]" />
            <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight">History</h1>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)]">Network performance trends over time</p>
        </div>
        {/* Range selector */}
        <div className="flex bg-white border border-[var(--border)] rounded-xl p-0.5" style={{ boxShadow: "var(--shadow-card)" }}>
          {RANGES.map(({ label, hours: h }) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                hours === h
                  ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {statCards.map(({ label, icon: Icon, value, unit, color }) => (
          <div key={label} className="bg-white rounded-2xl p-3 border border-[var(--border)]" style={{ boxShadow: "var(--shadow-card)" }}>
            <Icon size={13} style={{ color }} className="mb-2" />
            <p className="text-[10px] text-[var(--text-tertiary)] leading-tight">{label}</p>
            <p className="text-[15px] font-bold text-[var(--text-primary)] leading-tight">
              {value} <span className="text-[10px] font-normal text-[var(--text-tertiary)]">{unit}</span>
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-10 text-center text-[var(--text-tertiary)] text-[13px]">
          Loading…
        </div>
      ) : chartData.length < 2 ? (
        <div className="bg-white rounded-2xl border border-[var(--border)] p-10 text-center">
          <Zap size={28} className="text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-[14px] font-medium text-[var(--text-primary)]">No tests in this range</p>
          <p className="text-[13px] text-[var(--text-secondary)]">Run a speed test to start collecting data.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Bandwidth chart */}
          <div className="bg-white rounded-2xl border border-[var(--border)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <p className="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-4">
              Bandwidth History
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="dlh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ulh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#a1a1a6" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1a6" }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${v}M`} />
                <Tooltip contentStyle={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, fontSize: 11 }}
                  formatter={(v, name) => [`${v} Mbps`, String(name) === "dl" ? "Download" : "Upload"]} />
                <Area type="monotone" dataKey="dl" stroke="#60a5fa" strokeWidth={2} fill="url(#dlh)" dot={false} isAnimationActive={false} name="dl" />
                <Area type="monotone" dataKey="ul" stroke="#a78bfa" strokeWidth={2} fill="url(#ulh)" dot={false} isAnimationActive={false} name="ul" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"><span className="w-3 h-1 rounded bg-blue-400 inline-block" />Download</span>
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"><span className="w-3 h-1 rounded bg-violet-400 inline-block" />Upload</span>
            </div>
          </div>

          {/* Latency + jitter chart */}
          <div className="bg-white rounded-2xl border border-[var(--border)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <p className="text-[12px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-4">
              Latency History
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="lath" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#a1a1a6" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1a6" }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}ms`} />
                <Tooltip contentStyle={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, fontSize: 11 }}
                  formatter={(v) => [`${v} ms`, "Latency"]} />
                <Area type="monotone" dataKey="lat" stroke="#16a34a" strokeWidth={2} fill="url(#lath)" dot={false} isAnimationActive={false} name="lat" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Test log table */}
          <div className="bg-white rounded-2xl border border-[var(--border)] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[var(--surface)]">
                  {["Time", "Score", "Download", "Upload", "Latency", "Jitter", "Loss"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--text-tertiary)] tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tests.slice(0, 30).map((t, i) => {
                  const { color } = t.score != null ? scoreLabel(t.score) : { color: "#a1a1a6" };
                  return (
                    <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-[var(--surface)]"}>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">{new Date(t.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-semibold" style={{ color }}>{t.score ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)]">{t.download != null ? `${t.download}M` : "—"}</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)]">{t.upload != null ? `${t.upload}M` : "—"}</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)]">{t.latency != null ? `${t.latency}ms` : "—"}</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)]">{t.jitter != null ? `${t.jitter}ms` : "—"}</td>
                      <td className="px-4 py-2.5 text-[var(--text-primary)]">{t.packetLoss != null ? `${t.packetLoss}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
