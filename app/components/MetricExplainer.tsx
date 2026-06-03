"use client";

import { useState, useEffect } from "react";
import { X, Brain, Lightbulb, Zap } from "lucide-react";

type MetricInfo = {
  name: string;
  value: string | number;
  unit: string;
  color: string;
  context?: string;
};

type Explanation = {
  status: string;
  explanation: string;
  recommendation: string;
};

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  Excellent:   { color: "#16a34a", bg: "rgba(22,163,74,0.15)" },
  Good:        { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  Acceptable:  { color: "#60a5fa", bg: "rgba(96,165,250,0.15)" },
  Concerning:  { color: "#f97316", bg: "rgba(249,115,22,0.15)" },
  Critical:    { color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  Unknown:     { color: "#a1a1a6", bg: "rgba(161,161,166,0.12)" },
};

export function MetricExplainer({
  metric,
  onClose,
}: {
  metric: MetricInfo;
  onClose: () => void;
}) {
  const [data, setData] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    fetch("/api/ai/metric-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metric: metric.name,
        value: metric.value,
        unit: metric.unit,
        context: metric.context,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setRevealed(true));
        });
      })
      .catch(() => {
        setData({
          status: "Unknown",
          explanation: "Unable to fetch AI analysis. Check GROQ_API_KEY.",
          recommendation: "Ensure GROQ_API_KEY is set in your environment.",
        });
        setLoading(false);
      });
  }, []); // eslint-disable-line

  const statusCfg = data ? (STATUS_CONFIG[data.status] ?? STATUS_CONFIG.Unknown) : STATUS_CONFIG.Unknown;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          // Deep indigo-navy glassmorphism — NOT black. Lighter, more premium.
          background: "linear-gradient(145deg, rgba(22,30,75,0.96) 0%, rgba(35,22,80,0.96) 100%)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(120,140,255,0.25)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 50px rgba(100,120,255,0.12), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Subtle aurora inside modal */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div style={{
            position: "absolute", top: "-30%", left: "-10%",
            width: "60%", height: "60%",
            background: `radial-gradient(ellipse, rgba(${metric.color},0.12) 0%, transparent 70%)`,
            filter: "blur(20px)",
            animation: "aurora-pulse 4s ease-in-out infinite alternate",
          }} />
          <div style={{
            position: "absolute", bottom: "-20%", right: "-5%",
            width: "50%", height: "50%",
            background: "radial-gradient(ellipse, rgba(167,139,250,0.1) 0%, transparent 70%)",
            filter: "blur(15px)",
            animation: "aurora-pulse 5s ease-in-out 1s infinite alternate",
          }} />
        </div>

        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-1"
                style={{ color: "rgba(167,139,250,0.7)" }}>
                Network Metric
              </p>
              <h2 className="text-[17px] font-bold text-white leading-tight">{metric.name}</h2>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[40px] font-bold leading-none"
                  style={{ color: `rgb(${metric.color})` }}>
                  {metric.value}
                </span>
                {metric.unit && (
                  <span className="text-[14px] font-medium" style={{ color: `rgba(${metric.color},0.7)` }}>
                    {metric.unit}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <X size={13} className="text-white opacity-60" />
              </button>
              {data && (
                <span
                  className="text-[11px] font-bold px-3 py-1 rounded-full"
                  style={{ color: statusCfg.color, background: statusCfg.bg }}
                >
                  {data.status}
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="mb-5 h-px" style={{
            background: "linear-gradient(90deg, transparent, rgba(96,165,250,0.3), transparent)"
          }} />

          {/* Content */}
          {loading ? (
            <div className="py-8 flex flex-col items-center gap-3">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
                  style={{ borderTopColor: `rgb(${metric.color})` }} />
                <Zap size={14} className="absolute inset-0 m-auto"
                  style={{ color: `rgb(${metric.color})` }} />
              </div>
              <p className="text-[12px] text-white opacity-40">Analyzing with Groq AI…</p>
            </div>
          ) : data && (
            <div
              className="space-y-5"
              style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 0.35s ease, transform 0.35s ease",
              }}
            >
              {/* What This Means */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Brain size={13} style={{ color: "rgba(167,139,250,0.9)" }} />
                  <span className="text-[12px] font-semibold"
                    style={{ color: "rgba(167,139,250,0.9)" }}>
                    What This Means
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(220,230,255,0.8)" }}>
                  {data.explanation}
                </p>
              </div>

              {/* Recommendation */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Lightbulb size={13} style={{ color: "rgba(251,191,36,0.9)" }} />
                  <span className="text-[12px] font-semibold"
                    style={{ color: "rgba(251,191,36,0.9)" }}>
                    Recommendation
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(220,230,255,0.8)" }}>
                  {data.recommendation}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: `rgb(${metric.color})` }} />
              <span className="text-[10px]" style={{ color: "rgba(180,200,255,0.5)" }}>
                Powered by Groq AI
              </span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-[13px] font-medium transition-all"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "rgba(220,235,255,0.85)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
