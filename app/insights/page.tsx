"use client";

import { useState, useEffect } from "react";
import { Brain, RefreshCw, ChevronDown, ChevronUp, Zap, AlertTriangle, Info, AlertCircle } from "lucide-react";

type Insight = {
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
};

type TestSession = {
  download: number | null;
  upload: number | null;
  latency: number | null;
  jitter: number | null;
  packetLoss: number | null;
  score: number | null;
};

const SEVERITY_CONFIG = {
  low: { color: "#16a34a", bg: "bg-green-50 border-green-100", label: "LOW", icon: Info },
  medium: { color: "#d97706", bg: "bg-amber-50 border-amber-100", label: "MEDIUM", icon: AlertTriangle },
  high: { color: "#f97316", bg: "bg-orange-50 border-orange-100", label: "HIGH", icon: AlertTriangle },
  critical: { color: "#dc2626", bg: "bg-red-50 border-red-100", label: "CRITICAL", icon: AlertCircle },
};

const FILTERS = ["All", "Low", "Medium", "High", "Critical"] as const;

function InsightCard({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false);
  const cfg = SEVERITY_CONFIG[insight.severity];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-2xl border p-5 ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span
            className="text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 mt-0.5"
            style={{ background: cfg.color, color: "white" }}
          >
            {cfg.label}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[var(--text-tertiary)] mb-0.5">{insight.category}</p>
            <p className="font-semibold text-[15px] text-[var(--text-primary)] leading-snug">{insight.title}</p>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">{insight.description}</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:bg-white hover:bg-opacity-60 transition-colors shrink-0"
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3">
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Impact</p>
            <p className="text-[13px] text-[var(--text-secondary)]">{insight.impact}</p>
          </div>
          <div className="flex items-start gap-2">
            <Icon size={13} style={{ color: cfg.color }} className="mt-0.5 shrink-0" />
            <p className="text-[13px] text-[var(--text-secondary)]">{insight.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [latestTest, setLatestTest] = useState<TestSession | null>(null);
  const [noApiKey, setNoApiKey] = useState(false);

  useEffect(() => {
    fetch("/api/tests?hours=24")
      .then((r) => r.json())
      .then((tests: TestSession[]) => {
        if (tests[0]) { setLatestTest(tests[0]); fetchInsights(tests[0]); }
      });
  }, []); // eslint-disable-line

  async function fetchInsights(test: TestSession) {
    setLoading(true);
    setNoApiKey(false);
    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(test),
      });
      if (res.status === 503) { setNoApiKey(true); return; }
      const { insights: data } = await res.json();
      setInsights(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === "All"
    ? insights
    : insights.filter((i) => i.severity === filter.toLowerCase());

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain size={18} className="text-[var(--text-secondary)]" />
            <h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight">AI Insights</h1>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)]">Intelligent analysis of your network performance</p>
        </div>
        {latestTest && (
          <button
            onClick={() => latestTest && fetchInsights(latestTest)}
            disabled={loading}
            className="btn-primary flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        )}
      </div>

      {/* API key warning */}
      {noApiKey && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[13px] text-amber-700">
          <p className="font-semibold mb-1">GROQ_API_KEY not configured</p>
          <p>Get free key at <strong>console.groq.com</strong>, then replace <code className="bg-amber-100 px-1 rounded">gsk_YOUR_KEY_HERE</code> in <code className="bg-amber-100 px-1 rounded">.env.local</code> to enable AI analysis.</p>
        </div>
      )}

      {/* No test data */}
      {!latestTest && !loading && (
        <div className="text-center py-16">
          <Zap size={32} className="text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-[14px] font-medium text-[var(--text-primary)] mb-1">No test data</p>
          <p className="text-[13px] text-[var(--text-secondary)]">Run a speed test first to generate AI insights.</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-[var(--surface)] rounded-2xl animate-pulse" />
          ))}
          <p className="text-center text-[13px] text-[var(--text-tertiary)] animate-pulse">Analyzing with Claude AI…</p>
        </div>
      )}

      {/* Filter chips */}
      {insights.length > 0 && !loading && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {FILTERS.map((f) => {
            const count = f === "All" ? insights.length : insights.filter((i) => i.severity === f.toLowerCase()).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all border ${
                  filter === f
                    ? "bg-[var(--text-primary)] text-white border-transparent"
                    : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                {f} {count > 0 && <span className="opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Insights */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
