"use client";

import { useState, useRef, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Zap, Download, Upload, Activity, Timer, Wifi } from "lucide-react";
import { calculateScore, scoreLabel } from "@/lib/score";
import { MetricExplainer } from "@/app/components/MetricExplainer";

type Phase = "idle" | "latency" | "download" | "upload" | "done";

type Result = {
  download: number;
  upload: number;
  latency: number;
  jitter: number;
  packetLoss: number;
  score: number;
};

function GaugeRing({ score, size = 160 }: { score: number; size?: number }) {
  const r = 58;
  const circ = 2 * Math.PI * r;
  const { label, color } = scoreLabel(score);
  const progress = (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f0f0f3" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circ}`}
          strokeDashoffset={circ * 0.25}
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-[32px] font-bold text-[var(--text-primary)] leading-none">{score}</p>
        <p className="text-[12px] font-semibold mt-0.5" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  color = "var(--text-primary)",
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="metric-tile bg-white rounded-2xl p-5 border border-[var(--border)]"
      style={{ boxShadow: "var(--shadow-card)" }}
      onClick={onClick}
      title="Click for AI explanation"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-[var(--surface)] flex items-center justify-center">
          <Icon size={15} style={{ color }} />
        </div>
        <span className="text-[12px] font-medium text-[var(--text-secondary)]">{label}</span>
        {onClick && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(96,165,250,0.1)", color: "rgba(96,165,250,0.8)" }}>
            AI
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[28px] font-bold text-[var(--text-primary)] leading-none">{value}</span>
        <span className="text-[13px] text-[var(--text-secondary)]">{unit}</span>
      </div>
    </div>
  );
}

type MetricInfo = { name: string; value: string | number; unit: string; color: string; context?: string };

export default function SpeedTestPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [livePoints, setLivePoints] = useState<{ t: number; mbps: number }[]>([]);
  const [progress, setProgress] = useState(0);
  const [activeMetric, setActiveMetric] = useState<MetricInfo | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function openExplainer(info: MetricInfo) { setActiveMetric(info); }

  const runTest = useCallback(async () => {
    setPhase("latency");
    setResult(null);
    setLivePoints([]);
    setProgress(5);

    // ── 1. Latency + jitter ──────────────────────────────────────────────────
    const latSamples: number[] = [];
    let failed = 0;
    for (let i = 0; i < 10; i++) {
      try {
        const t0 = performance.now();
        await fetch("/api/speed-test/ping", { cache: "no-store" });
        latSamples.push(performance.now() - t0);
      } catch { failed++; }
    }
    const latency = Math.round(Math.min(...latSamples) * 10) / 10;
    const avgLat = latSamples.reduce((a, b) => a + b, 0) / latSamples.length;
    const jitter = Math.round(
      Math.sqrt(latSamples.reduce((a, b) => a + Math.pow(b - avgLat, 2), 0) / latSamples.length) * 10
    ) / 10;
    const packetLoss = Math.round((failed / 10) * 1000) / 10;

    setProgress(20);

    // ── 2. Download speed ─────────────────────────────────────────────────────
    setPhase("download");
    let dlMbps = 0;
    try {
      const dlPoints: { t: number; mbps: number }[] = [];
      const dlCtrl = new AbortController();
      abortRef.current = dlCtrl;
      const res = await fetch("/api/speed-test/download?size=15000000", {
        signal: dlCtrl.signal,
        cache: "no-store",
      });
      const reader = res.body!.getReader();
      let bytes = 0, tStart = performance.now(), tLast = tStart, bLast = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        const now = performance.now();
        if (now - tLast >= 250) {
          const instantMbps = ((bytes - bLast) * 8) / ((now - tLast) / 1000) / 1_000_000;
          dlPoints.push({ t: dlPoints.length, mbps: Math.round(instantMbps * 10) / 10 });
          setLivePoints([...dlPoints]);
          bLast = bytes; tLast = now;
        }
        setProgress(20 + Math.round((bytes / 15_000_000) * 40));
      }
      dlMbps = Math.round((bytes * 8) / ((performance.now() - tStart) / 1000) / 1_000_000 * 10) / 10;
    } catch { /* aborted */ }

    setProgress(60);

    // ── 3. Upload speed ───────────────────────────────────────────────────────
    setPhase("upload");
    const upPoints: { t: number; mbps: number }[] = [];
    let ulMbps = 0;
    try {
      const ulSize = 3_000_000;
      const data = new Uint8Array(ulSize).fill(65);
      const t0 = performance.now();
      await fetch("/api/speed-test/upload", { method: "POST", body: data, cache: "no-store" });
      const elapsed = (performance.now() - t0) / 1000;
      ulMbps = Math.round((ulSize * 8) / elapsed / 1_000_000 * 10) / 10;
      upPoints.push({ t: 0, mbps: ulMbps });
      setLivePoints(upPoints);
    } catch { /* */ }

    setProgress(90);

    // ── 4. Score + save ───────────────────────────────────────────────────────
    const score = calculateScore({ download: dlMbps, upload: ulMbps, latency, jitter, packetLoss });
    const res: Result = { download: dlMbps, upload: ulMbps, latency, jitter, packetLoss, score };
    setResult(res);
    setPhase("done");
    setProgress(100);

    // Save to DB
    try {
      await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(res),
      });
    } catch { /* non-critical */ }
  }, []);

  const phaseLabel: Record<Phase, string> = {
    idle: "",
    latency: "Measuring latency & jitter…",
    download: "Testing download speed…",
    upload: "Testing upload speed…",
    done: "Test complete",
  };

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={18} className="text-[var(--text-secondary)]" />
          <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight">Speed Test</h1>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Measure download, upload, latency, and jitter
        </p>
      </div>

      {/* Test area */}
      <div className="bg-white rounded-2xl border border-[var(--border)] p-6 mb-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex flex-col items-center">
          {/* Gauge */}
          <GaugeRing score={result?.score ?? (phase === "idle" ? 0 : Math.round(progress * 0.7))} />

          {/* Phase label */}
          {phase !== "idle" && phase !== "done" && (
            <p className="text-[13px] text-[var(--text-secondary)] mt-3 animate-pulse">
              {phaseLabel[phase]}
            </p>
          )}

          {/* Progress bar */}
          {phase !== "idle" && phase !== "done" && (
            <div className="w-48 h-1 bg-[var(--surface)] rounded-full mt-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #60a5fa, #a78bfa)",
                }}
              />
            </div>
          )}

          {/* Run button */}
          {(phase === "idle" || phase === "done") && (
            <button
              onClick={runTest}
              className="mt-5 btn-primary px-8 py-3 text-[15px] font-semibold rounded-2xl"
            >
              {phase === "done" ? "Run Again" : "Start Test"}
            </button>
          )}
        </div>

        {/* Live chart during download */}
        {phase === "download" && livePoints.length > 2 && (
          <div className="mt-5 bg-[var(--surface)] rounded-xl p-3">
            <p className="text-[11px] text-[var(--text-tertiary)] mb-2 font-medium tracking-wide uppercase">
              Live Download
            </p>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={livePoints} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="dlg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="mbps" stroke="#60a5fa" strokeWidth={2} fill="url(#dlg)" dot={false} isAnimationActive={false} />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v) => [`${v} Mbps`, ""]}
                  labelFormatter={() => ""}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Results grid */}
      {result && (
        <>
          <p className="text-[11px] text-[var(--text-tertiary)] mb-3 tracking-wide">
            💡 Tap any card for AI explanation
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <MetricCard icon={Download} label="Download" value={result.download} unit="Mbps" color="#3b82f6"
              onClick={() => openExplainer({ name: "Download Speed", value: result!.download, unit: "Mbps", color: "96,165,250",
                context: `Upload: ${result!.upload}Mbps, Latency: ${result!.latency}ms` })} />
            <MetricCard icon={Upload} label="Upload" value={result.upload} unit="Mbps" color="#8b5cf6"
              onClick={() => openExplainer({ name: "Upload Speed", value: result!.upload, unit: "Mbps", color: "167,139,250",
                context: `Download: ${result!.download}Mbps, Latency: ${result!.latency}ms` })} />
            <MetricCard icon={Timer} label="Latency" value={result.latency} unit="ms" color="#16a34a"
              onClick={() => openExplainer({ name: "Network Latency", value: result!.latency, unit: "ms", color: "34,197,94",
                context: `Jitter: ${result!.jitter}ms, Packet Loss: ${result!.packetLoss}%` })} />
            <MetricCard icon={Activity} label="Jitter" value={result.jitter} unit="ms" color="#d97706"
              onClick={() => openExplainer({ name: "Network Jitter", value: result!.jitter, unit: "ms", color: "251,191,36",
                context: `Latency: ${result!.latency}ms, Download: ${result!.download}Mbps` })} />
            <MetricCard icon={Wifi} label="Packet Loss" value={result.packetLoss} unit="%" color={result.packetLoss > 0 ? "#dc2626" : "#16a34a"}
              onClick={() => openExplainer({ name: "Packet Loss", value: result!.packetLoss, unit: "%", color: result!.packetLoss > 0 ? "239,68,68" : "34,197,94",
                context: `Latency: ${result!.latency}ms, Jitter: ${result!.jitter}ms` })} />
            <MetricCard icon={Zap} label="Health Score" value={result.score} unit="/ 100" color={scoreLabel(result.score).color}
              onClick={() => openExplainer({ name: "Network Health Score", value: result!.score, unit: "/ 100", color: "96,165,250",
                context: `Download: ${result!.download}Mbps, Upload: ${result!.upload}Mbps, Latency: ${result!.latency}ms, Jitter: ${result!.jitter}ms` })} />
          </div>
        </>
      )}

      {activeMetric && (
        <MetricExplainer metric={activeMetric} onClose={() => setActiveMetric(null)} />
      )}
    </div>
  );
}
