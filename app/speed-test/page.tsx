"use client";

import { useState, useCallback, useEffect } from "react";
import { Zap, MapPin, Globe, Wifi, Server, RefreshCw } from "lucide-react";
import { calculateScore, scoreLabel } from "@/lib/score";
import { MetricExplainer } from "@/app/components/MetricExplainer";

type Phase = "idle" | "latency" | "download" | "upload" | "done";
type MetricInfo = { name: string; value: string | number; unit: string; color: string; context?: string };
type ConnInfo = { ip: string; isp: string; city: string; country: string };
type Result = { download: number; upload: number; latency: number; jitter: number; packetLoss: number; score: number };

// ── Log-scale helpers ────────────────────────────────────────────────────────
const MAX_MBPS = 1000;
function mbpsToFraction(mbps: number) {
  if (mbps <= 0) return 0;
  return Math.min(Math.log(1 + mbps) / Math.log(1 + MAX_MBPS), 1);
}
function fractionToAngle(f: number) { return 135 + f * 270; } // 135→405°

function polarXY(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r: number, a1: number, a2: number) {
  const s = polarXY(cx, cy, r, a1);
  const e = polarXY(cx, cy, r, a2);
  const sweep = ((a2 - a1) + 360) % 360;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// ── Scale ticks ──────────────────────────────────────────────────────────────
const TICKS = [0, 5, 10, 25, 50, 100, 250, 500, 750, 1000];
const MAJOR = [0, 50, 100, 500, 1000];
const CX = 150, CY = 148;

// ── Speedometer ──────────────────────────────────────────────────────────────
function Speedometer({ speed, phase, lastActivePhase }: { speed: number; phase: Phase; lastActivePhase: "download" | "upload" }) {
  const upload = phase === "upload" || (phase === "done" && lastActivePhase === "upload");
  const gid = upload ? "gu" : "gd";
  const c1 = upload ? "#a855f7" : "#22d3ee";
  const c2 = upload ? "#ec4899" : "#3b82f6";
  const active = phase !== "idle";
  const f = mbpsToFraction(speed);
  const fillEnd = fractionToAngle(f);

  const trackPath = arcPath(CX, CY, 110, 135, 405);
  const fillPath = f > 0.003 ? arcPath(CX, CY, 110, 135, fillEnd) : null;

  const displayNum = speed >= 100
    ? Math.round(speed).toString()
    : speed > 0 ? speed.toFixed(1) : "—";

  return (
    <svg viewBox="0 0 300 230" className="w-full max-w-xs mx-auto select-none">
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
        <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Track */}
      <path d={trackPath} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="12" strokeLinecap="round" />

      {/* Fill */}
      {active && fillPath && (
        <path d={fillPath} fill="none" stroke={`url(#${gid})`}
          strokeWidth="12" strokeLinecap="round"
          filter="url(#gaugeGlow)"
          style={{ transition: "d 0.12s linear" }} />
      )}

      {/* Scale ticks */}
      {TICKS.map((v) => {
        const a = fractionToAngle(mbpsToFraction(v));
        const o = polarXY(CX, CY, 99, a);
        const i = polarXY(CX, CY, 92, a);
        const lp = polarXY(CX, CY, 82, a);
        const major = MAJOR.includes(v);
        return (
          <g key={v}>
            <line x1={i.x} y1={i.y} x2={o.x} y2={o.y}
              stroke="rgba(0,0,0,0.12)" strokeWidth={major ? 1.5 : 0.8} />
            {major && v > 0 && (
              <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
                fontSize="8.5" fill="rgba(0,0,0,0.3)" fontFamily="inherit">
                {v >= 1000 ? "1k" : v}
              </text>
            )}
          </g>
        );
      })}

      {/* Center text */}
      <text x={CX} y={CY - 10} textAnchor="middle"
        fontSize={speed >= 1000 ? "34" : "42"} fontWeight="700"
        fill={active ? `url(#${gid})` : "rgba(0,0,0,0.12)"}
        fontFamily="inherit">
        {displayNum}
      </text>
      <text x={CX} y={CY + 18} textAnchor="middle" fontSize="11"
        fill="rgba(0,0,0,0.35)" fontFamily="inherit">
        Mbps
      </text>
    </svg>
  );
}

// ── Connection info ────────────────────────────────────────────────────────────
function ConnBar({ conn }: { conn: ConnInfo | null }) {
  if (!conn) return (
    <div className="flex justify-center">
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] animate-pulse">
        <RefreshCw size={10} className="animate-spin" />Detecting connection…
      </div>
    </div>
  );
  const isp = conn.isp?.replace(/^AS\d+\s+/, "").split(" ").slice(0, 3).join(" ") || "—";
  const info = [
    { icon: Wifi, label: "Network", val: isp },
    { icon: Globe, label: "IP", val: conn.ip, mono: true },
    { icon: MapPin, label: "Location", val: [conn.city, conn.country].filter(v => v && v !== "undefined").join(", ") || "—" },
    { icon: Server, label: "Server", val: "Cloudflare Edge" },
  ];
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {info.map(({ icon: Icon, label, val, mono }) => (
        <div key={label} className="flex items-center gap-1.5">
          <Icon size={12} className="text-[var(--text-tertiary)] shrink-0" />
          <div>
            <p className="text-[9px] text-[var(--text-tertiary)] leading-tight">{label}</p>
            <p className={`text-[12px] font-semibold text-[var(--text-primary)] leading-tight ${mono ? "font-mono" : ""}`}>{val}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────────
export default function SpeedTestPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lastActivePhase, setLastActivePhase] = useState<"download" | "upload">("download");
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [ping, setPing] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [conn, setConn] = useState<ConnInfo | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricInfo | null>(null);

  useEffect(() => {
    fetch("/api/ip-info").then(r => r.json()).then(setConn).catch(() => {});
  }, []);

  const runTest = useCallback(async () => {
    setPhase("latency");
    setResult(null);
    setLiveSpeed(0);
    setPing(null);

    // 1 — Latency
    const samp: number[] = [];
    let failed = 0;
    for (let i = 0; i < 10; i++) {
      try {
        const t = performance.now();
        await fetch("https://speed.cloudflare.com/__down?bytes=0", { cache: "no-store" });
        samp.push(performance.now() - t);
      } catch { failed++; }
    }
    const latency = samp.length ? Math.round(Math.min(...samp) * 10) / 10 : 0;
    const avgL = samp.reduce((a, b) => a + b, 0) / (samp.length || 1);
    const jitter = Math.round(
      Math.sqrt(samp.reduce((a, b) => a + Math.pow(b - avgL, 2), 0) / (samp.length || 1)) * 10
    ) / 10;
    const packetLoss = Math.round((failed / 10) * 1000) / 10;
    setPing(latency);

    // 2 — Download
    setPhase("download");
    setLastActivePhase("download");
    setLiveSpeed(0);
    let dlMbps = 0;
    try {
      const res = await fetch("https://speed.cloudflare.com/__down?bytes=25000000", { cache: "no-store" });
      const reader = res.body!.getReader();
      let bytes = 0, t0 = performance.now(), tL = t0, bL = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        const now = performance.now();
        if (now - tL >= 150) {
          setLiveSpeed(Math.round(((bytes - bL) * 8) / ((now - tL) / 1000) / 1_000_000 * 10) / 10);
          bL = bytes; tL = now;
        }
      }
      dlMbps = Math.round((bytes * 8) / ((performance.now() - t0) / 1000) / 1_000_000 * 10) / 10;
    } catch { /* */ }
    setLiveSpeed(dlMbps);

    // 3 — Upload (6 parallel streams × 8MB = 48MB total)
    setPhase("upload");
    setLastActivePhase("upload");
    setLiveSpeed(0);
    let ulMbps = 0;
    const STREAMS = 8, CHUNK = 2_000_000; // 2MB × 8 streams = 16MB; under 4.5MB Edge body limit
    try {
      const buf = new Uint8Array(CHUNK).fill(65);
      const t0 = performance.now();
      let done_ = 0;

      await Promise.all(Array.from({ length: STREAMS }, () =>
        new Promise<void>(res => {
          const xhr = new XMLHttpRequest();
          xhr.onloadend = () => {
            done_++;
            const el = (performance.now() - t0) / 1000;
            if (el > 0.1) setLiveSpeed(Math.round((done_ * CHUNK * 8) / el / 1_000_000 * 10) / 10);
            res();
          };
          xhr.timeout = 30000;
          xhr.ontimeout = () => res();
          xhr.open("POST", "https://pulsenet.msrx.co.in/api/speed-test/upload");
          xhr.send(buf.buffer.slice(0));
        })
      ));

      const elapsed = (performance.now() - t0) / 1000;
      ulMbps = elapsed > 0.1 ? Math.round((CHUNK * STREAMS * 8) / elapsed / 1_000_000 * 10) / 10 : 0;
    } catch { /* */ }
    setLiveSpeed(ulMbps);

    // 4 — Score + save
    const score = calculateScore({ download: dlMbps, upload: ulMbps, latency, jitter, packetLoss });
    const res: Result = { download: dlMbps, upload: ulMbps, latency, jitter, packetLoss, score };
    setResult(res);
    setPhase("done");

    try {
      await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...res, ip: conn?.ip, isp: conn?.isp, location: conn?.city }),
      });
    } catch { /* */ }
  }, [conn]);

  const upload = phase === "upload" || (phase === "done" && lastActivePhase === "upload");
  const isActive = phase !== "idle" && phase !== "done";
  const { color: scoreColor, label: scoreLbl } = result ? scoreLabel(result.score) : { color: "#a1a1a6", label: "" };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Zap size={18} className="text-[var(--text-secondary)]" />
        <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight">Speed Test</h1>
        {ping !== null && (
          <span className="ml-auto text-[12px] text-[var(--text-tertiary)]">
            Ping <span className="font-semibold text-[var(--text-primary)]">{ping}ms</span>
          </span>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-[var(--border)] overflow-hidden"
        style={{ boxShadow: "0 4px 40px rgba(0,0,0,0.08)" }}>

        {/* Phase tabs */}
        {phase !== "idle" && (
          <div className="flex border-b border-[var(--border)]">
            {[
              { key: "download", label: "DOWNLOAD", c: "#22d3ee", val: result?.download },
              { key: "upload", label: "UPLOAD", c: "#a855f7", val: result?.upload },
            ].map(({ key, label, c, val }) => {
              const active = phase === key || (phase === "done");
              return (
                <div key={key} className="flex-1 py-2.5 flex items-center justify-center gap-2 transition-all"
                  style={{
                    borderBottom: `2px solid ${active ? c : "transparent"}`,
                    color: active ? c : "rgba(0,0,0,0.25)",
                  }}>
                  <span className="text-[10px] font-bold tracking-widest">{label}</span>
                  {phase === "done" && val != null && (
                    <span className="text-[14px] font-bold">{val}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="p-5 pt-4">
          {/* Gauge */}
          <Speedometer speed={liveSpeed} phase={phase} lastActivePhase={lastActivePhase} />

          {/* Phase status */}
          {isActive && (
            <div className="flex items-center justify-center gap-1.5 -mt-2 mb-3 h-5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: upload ? "#a855f7" : "#22d3ee" }} />
              <span className="text-[12px] text-[var(--text-secondary)]">
                {phase === "latency" ? "Measuring ping…" : phase === "download" ? "Testing download…" : "Testing upload…"}
              </span>
            </div>
          )}

          {/* Score badge when done */}
          {phase === "done" && result && (
            <div className="flex justify-center -mt-2 mb-4">
              <span className="text-[12px] font-semibold px-3 py-1 rounded-full"
                style={{ background: `${scoreColor}18`, color: scoreColor }}>
                {result.score} / 100 · {scoreLbl}
              </span>
            </div>
          )}

          {/* Start button */}
          {(phase === "idle" || phase === "done") && (
            <div className="flex justify-center mb-5">
              <button onClick={runTest}
                className="w-20 h-20 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-105 active:scale-95"
                style={{
                  border: `3px solid ${phase === "done" ? scoreColor : "#22d3ee"}`,
                  background: `${phase === "done" ? scoreColor : "#22d3ee"}08`,
                  boxShadow: `0 0 24px ${phase === "done" ? scoreColor : "#22d3ee"}30`,
                  color: phase === "done" ? scoreColor : "#22d3ee",
                }}>
                {phase === "done" ? (
                  <><RefreshCw size={18} /><span className="text-[9px] font-bold tracking-widest">RETEST</span></>
                ) : (
                  <><Zap size={20} /><span className="text-[9px] font-bold tracking-widest">START</span></>
                )}
              </button>
            </div>
          )}

          {/* Connection info */}
          <div className="pt-4 border-t border-[var(--border)]">
            <ConnBar conn={conn} />
          </div>
        </div>
      </div>

      {/* Metric cards */}
      {result && phase === "done" && (
        <div className="mt-4">
          <p className="text-[11px] text-[var(--text-tertiary)] mb-3">
            💡 Tap a card for AI explanation
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Download", value: result.download, unit: "Mbps", color: "#22d3ee",
                metric: { name: "Download Speed", value: result.download, unit: "Mbps", color: "34,211,238", context: `Upload: ${result.upload}Mbps` } },
              { label: "Upload", value: result.upload, unit: "Mbps", color: "#a855f7",
                metric: { name: "Upload Speed", value: result.upload, unit: "Mbps", color: "168,85,247", context: `Download: ${result.download}Mbps` } },
              { label: "Latency", value: result.latency, unit: "ms", color: "#22c55e",
                metric: { name: "Latency", value: result.latency, unit: "ms", color: "34,197,94", context: `Jitter: ${result.jitter}ms` } },
              { label: "Jitter", value: result.jitter, unit: "ms", color: "#f59e0b",
                metric: { name: "Jitter", value: result.jitter, unit: "ms", color: "245,158,11" } },
              { label: "Packet Loss", value: result.packetLoss, unit: "%",
                color: result.packetLoss > 0 ? "#ef4444" : "#22c55e",
                metric: { name: "Packet Loss", value: result.packetLoss, unit: "%", color: result.packetLoss > 0 ? "239,68,68" : "34,197,94" } },
              { label: "Health Score", value: `${result.score}/100`, unit: "", color: scoreColor, metric: null },
            ].map(({ label, value, unit, color, metric }) => (
              <div key={label}
                onClick={() => metric && setActiveMetric(metric)}
                className={`metric-tile bg-white rounded-2xl p-3.5 border border-[var(--border)] ${metric ? "cursor-pointer" : ""}`}
                style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-[var(--text-tertiary)] font-medium">{label}</p>
                  {metric && <span className="text-[8px] px-1 py-0.5 rounded"
                    style={{ background: `${color}18`, color }}>AI</span>}
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-[22px] font-bold leading-none" style={{ color }}>{value}</span>
                  {unit && <span className="text-[10px] text-[var(--text-tertiary)]">{unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeMetric && (
        <MetricExplainer metric={activeMetric} onClose={() => setActiveMetric(null)} />
      )}
    </div>
  );
}
