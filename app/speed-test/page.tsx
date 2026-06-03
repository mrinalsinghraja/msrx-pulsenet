"use client";

import { useState, useCallback, useEffect } from "react";
import { Zap, MapPin, Globe, Wifi, Server, RefreshCw, Monitor, Gamepad2, Video } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
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
function fractionToAngle(f: number) { return 135 + f * 270; }

function polarXY(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Fixed full-arc path (270°, from 135° → 405°). Both track and fill use same path.
// Fill controlled via strokeDashoffset — the ONLY reliable CSS-animatable arc property.
const CX = 150, CY = 148, R_ARC = 110;
const _s = polarXY(CX, CY, R_ARC, 135);
const _e = polarXY(CX, CY, R_ARC, 405);
const FULL_ARC_PATH = `M ${_s.x.toFixed(2)} ${_s.y.toFixed(2)} A ${R_ARC} ${R_ARC} 0 1 1 ${_e.x.toFixed(2)} ${_e.y.toFixed(2)}`;
const ARC_LENGTH = R_ARC * 270 * Math.PI / 180; // ≈ 518px

// ── Scale ticks ──────────────────────────────────────────────────────────────
const TICKS = [0, 5, 10, 25, 50, 100, 250, 500, 750, 1000];
const MAJOR = [0, 50, 100, 500, 1000];

// ── Speedometer ──────────────────────────────────────────────────────────────
function Speedometer({ speed, phase, lastActivePhase }: { speed: number; phase: Phase; lastActivePhase: "download" | "upload" }) {
  const upload = phase === "upload" || (phase === "done" && lastActivePhase === "upload");
  const gid = upload ? "gu" : "gd";
  const c1 = upload ? "#a855f7" : "#22d3ee";
  const c2 = upload ? "#ec4899" : "#3b82f6";
  const active = phase !== "idle";

  // strokeDashoffset animation: offset = full_length - filled_length
  // CSS transition on strokeDashoffset is hardware-accelerated and perfectly smooth
  const fillLength = mbpsToFraction(speed) * ARC_LENGTH;
  const dashOffset = active ? ARC_LENGTH - fillLength : ARC_LENGTH;

  const displayNum = speed >= 100
    ? Math.round(speed).toString()
    : speed > 0 ? speed.toFixed(1) : "—";

  return (
    <svg viewBox="0 0 300 230" className="w-full max-w-xs mx-auto select-none">
      <defs>
        <linearGradient id="gu" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="gd" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Track — full 270° arc, muted */}
      <path d={FULL_ARC_PATH} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="12" strokeLinecap="round" />

      {/* Fill — same 270° arc, clipped via strokeDashoffset (smooth CSS animation) */}
      <path
        d={FULL_ARC_PATH}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`}
        strokeDashoffset={dashOffset}
        filter="url(#gaugeGlow)"
        style={{ transition: "stroke-dashoffset 0.25s ease-out" }}
      />

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
  const [dlPoints, setDlPoints] = useState<{ t: number; mbps: number }[]>([]);
  const [upPoints, setUpPoints] = useState<{ t: number; mbps: number }[]>([]);

  useEffect(() => {
    fetch("/api/ip-info").then(r => r.json()).then(setConn).catch(() => {});
  }, []);

  const runTest = useCallback(async () => {
    setPhase("latency");
    setResult(null);
    setLiveSpeed(0);
    setPing(null);
    setDlPoints([]);
    setUpPoints([]);

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
    setDlPoints([]);
    let dlMbps = 0;
    try {
      const res = await fetch("https://speed.cloudflare.com/__down?bytes=25000000", { cache: "no-store" });
      const reader = res.body!.getReader();
      let bytes = 0, t0 = performance.now(), tL = t0, bL = 0;
      const pts: { t: number; mbps: number }[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        const now = performance.now();
        if (now - tL >= 150) {
          const instantMbps = Math.round(((bytes - bL) * 8) / ((now - tL) / 1000) / 1_000_000 * 10) / 10;
          setLiveSpeed(instantMbps);
          pts.push({ t: Math.round((now - t0) / 100) / 10, mbps: instantMbps });
          setDlPoints([...pts]);
          bL = bytes; tL = now;
        }
      }
      dlMbps = Math.round((bytes * 8) / ((performance.now() - t0) / 1000) / 1_000_000 * 10) / 10;
    } catch { /* */ }
    setLiveSpeed(dlMbps);

    // 3 — Upload: time-based 5s window, sequential chunks to Cloudflare nearest PoP
    setPhase("upload");
    setLastActivePhase("upload");
    setLiveSpeed(0);
    setUpPoints([]);
    let ulMbps = 0;
    try {
      const CHUNK = 2_000_000; // 2MB per request — stays under limits
      const buf = new Uint8Array(CHUNK).fill(65);
      const TEST_DURATION = 5500; // 5.5 seconds
      const t0 = performance.now();
      let totalBytes = 0;
      const ulPts: { t: number; mbps: number }[] = [];

      // Run concurrent streams for TEST_DURATION ms
      const runStream = async () => {
        while (performance.now() - t0 < TEST_DURATION) {
          await new Promise<void>(resolve => {
            const xhr = new XMLHttpRequest();
            xhr.onloadend = () => {
              totalBytes += CHUNK;
              const el = (performance.now() - t0) / 1000;
              if (el > 0.2) {
                const instantMbps = Math.round((totalBytes * 8) / el / 1_000_000 * 10) / 10;
                setLiveSpeed(instantMbps);
                ulPts.push({ t: Math.round(el * 10) / 10, mbps: instantMbps });
                setUpPoints([...ulPts]);
              }
              resolve();
            };
            xhr.timeout = 10000;
            xhr.ontimeout = () => resolve();
            // Use Cloudflare __up — routes to nearest PoP (Bangalore for India)
            xhr.open("POST", "https://speed.cloudflare.com/__up");
            xhr.send(buf.buffer.slice(0));
          });
        }
      };

      await Promise.all(Array.from({ length: 4 }, runStream)); // 4 concurrent streams
      const elapsed = (performance.now() - t0) / 1000;
      ulMbps = elapsed > 0.5 ? Math.round((totalBytes * 8) / elapsed / 1_000_000 * 10) / 10 : 0;
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

          {/* Start / Retest button — 3D with gradient + depth shadow */}
          {(phase === "idle" || phase === "done") && (
            <div className="flex justify-center mb-5">
              <button onClick={runTest}
                className="w-20 h-20 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-[1.06] active:scale-95"
                style={{
                  background: phase === "done"
                    ? `linear-gradient(145deg, ${scoreColor}cc 0%, ${scoreColor} 60%, ${scoreColor}dd 100%)`
                    : "linear-gradient(145deg, #45e8ff 0%, #22d3ee 55%, #0db8d4 100%)",
                  boxShadow: phase === "done"
                    ? `0 8px 24px ${scoreColor}55, 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 4px rgba(0,0,0,0.15)`
                    : "0 8px 24px rgba(34,211,238,0.5), 0 2px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.12)",
                  color: "white",
                  border: "none",
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

      {/* Two-panel charts with axes + gridlines */}
      {result && phase === "done" && (dlPoints.length > 2 || upPoints.length > 2) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { pts: dlPoints, color: "#22d3ee", gradId: "dlAreaG", label: "DOWNLOAD", val: result.download },
            { pts: upPoints, color: "#a855f7", gradId: "ulAreaG", label: "UPLOAD", val: result.upload },
          ].map(({ pts, color, gradId, label, val }) => pts.length > 2 && (
            <div key={label} className="bg-white rounded-2xl p-4 border border-[var(--border)]" style={{ boxShadow: "var(--shadow-card)" }}>
              {/* Header row: label + Mbps axis label + value */}
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <p className="text-[10px] font-bold tracking-wider" style={{ color }}>{label}</p>
                  <p className="text-[9px] text-[var(--text-tertiary)]">Mbps</p>
                </div>
                <p className="text-[13px] font-bold" style={{ color }}>{val} Mbps</p>
              </div>
              <ResponsiveContainer width="100%" height={105}>
                <AreaChart data={pts} margin={{ top: 4, right: 8, bottom: 18, left: 28 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis
                    dataKey="t"
                    tick={{ fontSize: 9, fill: "#a1a1a6" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(0,0,0,0.08)" }}
                    interval="preserveStartEnd"
                    label={{ value: "Time (s)", position: "insideBottom", offset: -5, fontSize: 9, fill: "#a1a1a6" }}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#a1a1a6" }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}G` : `${v}`}
                    /* No rotated label — moved to header above */
                  />
                  <Tooltip
                    contentStyle={{ background: "white", border: `1px solid ${color}30`, borderRadius: 8, fontSize: 11, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    formatter={(v) => [`${v} Mbps`, label === "DOWNLOAD" ? "Download" : "Upload"]}
                    labelFormatter={(l) => `${l}s`}
                    cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "4 2" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="mbps"
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#${gradId})`}
                    dot={false}
                    activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      {/* Network Quality Score (from Cloudflare model) */}
      {result && phase === "done" && (
        <div className="mt-3 bg-white rounded-2xl border border-[var(--border)] p-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-3">Network Quality</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Monitor, label: "Streaming", color: "#22d3ee",
                rating: result.download > 50 && result.jitter < 15 ? "Great" : result.download > 25 ? "Good" : result.download > 10 ? "Fair" : "Poor" },
              { icon: Gamepad2, label: "Gaming", color: "#a855f7",
                rating: result.latency < 20 && result.jitter < 8 ? "Great" : result.latency < 40 && result.jitter < 15 ? "Good" : result.latency < 80 ? "Fair" : "Poor" },
              { icon: Video, label: "Video Chat", color: "#22c55e",
                rating: result.upload > 10 && result.latency < 50 ? "Great" : result.upload > 5 && result.latency < 80 ? "Good" : result.upload > 2 ? "Fair" : "Poor" },
            ].map(({ icon: Icon, label, color, rating }) => {
              const ratingColor = rating === "Great" ? "#22c55e" : rating === "Good" ? "#22d3ee" : rating === "Fair" ? "#f59e0b" : "#ef4444";
              return (
                <div key={label} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}12` }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--text-tertiary)]">{label}</p>
                    <p className="text-[13px] font-semibold" style={{ color: ratingColor }}>{rating}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metric cards */}
      {result && phase === "done" && (
        <div className="mt-3">
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
