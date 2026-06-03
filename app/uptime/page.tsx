"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, ResponsiveContainer,
} from "recharts";
import {
  Plus, Trash2, RefreshCw, ExternalLink, Activity, CheckCircle,
  XCircle, Clock, X, TrendingUp, AlertCircle, ArrowUpRight, Radio,
} from "lucide-react";

type CheckRecord = { id: string; status: string; responseMs: number | null; statusCode: number | null; checkedAt: string };
type MonitorData = {
  id: string; name: string; url: string; interval: number;
  status: "up" | "down" | "pending"; responseMs: number | null;
  statusCode: number | null; checkedAt: string | null; uptime: number | null;
  history: CheckRecord[];
};

function StatusDot({ status }: { status: MonitorData["status"] }) {
  const color = status === "up" ? "#16a34a" : status === "down" ? "#dc2626" : "#d97706";
  return (
    <span className="relative inline-flex items-center justify-center w-3 h-3">
      {(status === "up" || status === "down") && (
        <span className="absolute inline-flex w-full h-full rounded-full opacity-40 animate-ping" style={{ backgroundColor: color }} />
      )}
      <span className="relative inline-flex rounded-full w-2.5 h-2.5" style={{ backgroundColor: color }} />
    </span>
  );
}

function timeAgo(dateStr: string) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function HistoryBar({ history, slots = 30, height = 16 }: { history: CheckRecord[]; slots?: number; height?: number }) {
  const arr: (CheckRecord | null)[] = Array(slots).fill(null);
  history.slice(0, slots).forEach((c, i) => { arr[slots - 1 - i] = c; });
  return (
    <div className="flex gap-px w-full">
      {arr.map((c, i) => (
        <div key={i} title={c ? `${c.status.toUpperCase()} · ${c.responseMs ?? "—"}ms` : "No data"}
          className="flex-1 rounded-sm" style={{ height, background: c ? (c.status === "up" ? "#16a34a" : "#dc2626") : "#e5e7eb", opacity: c ? 1 : 0.5 }} />
      ))}
    </div>
  );
}

function ResponseSparkline({ history }: { history: CheckRecord[] }) {
  const data = [...history].reverse().filter(h => h.responseMs != null).slice(-20).map(h => ({ ms: h.responseMs }));
  if (data.length < 3) return null;
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs><linearGradient id="usg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity={0.25} /><stop offset="100%" stopColor="#60a5fa" stopOpacity={0} /></linearGradient></defs>
        <Area type="monotone" dataKey="ms" stroke="#60a5fa" strokeWidth={1.5} fill="url(#usg)" dot={false} activeDot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MonitorDetailModal({ monitor, onClose }: { monitor: MonitorData; onClose: () => void }) {
  const [history, setHistory] = useState<CheckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`/api/monitors/${monitor.id}/history`).then(r => r.json()).then(d => { setHistory(d); setLoading(false); });
  }, [monitor.id]);
  const incidents = history.filter(h => h.status === "down").length;
  const avgMs = (() => { const u = history.filter(h => h.responseMs && h.status === "up"); return u.length ? Math.round(u.reduce((a, h) => a + (h.responseMs ?? 0), 0) / u.length) : null; })();
  const hostname = (() => { try { return new URL(monitor.url).hostname; } catch { return monitor.url; } })();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(6px)" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3 min-w-0">
            <StatusDot status={monitor.status} />
            <div className="min-w-0">
              <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">{monitor.name}</h2>
              <a href={monitor.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] flex items-center gap-1">{hostname}<ExternalLink size={11} /></a>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--surface)]"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-4 gap-3">
            {[{ label: "Status", value: monitor.status.toUpperCase(), color: monitor.status === "up" ? "#16a34a" : monitor.status === "down" ? "#dc2626" : "#d97706" }, { label: "Uptime (24h)", value: monitor.uptime != null ? `${monitor.uptime}%` : "—" }, { label: "Avg Response", value: avgMs != null ? `${avgMs}ms` : "—" }, { label: "Incidents", value: String(incidents), color: incidents > 0 ? "#dc2626" : undefined }].map(({ label, value, color }) => (
              <div key={label} className="bg-[var(--surface)] rounded-xl p-3 text-center">
                <p className="text-[11px] text-[var(--text-tertiary)] mb-1">{label}</p>
                <p className="text-[15px] font-semibold" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
              </div>
            ))}
          </div>
          {!loading && <><div><div className="flex items-center justify-between mb-2"><p className="text-[12px] font-medium text-[var(--text-secondary)]">Check history ({history.length} checks)</p><p className="text-[11px] text-[var(--text-tertiary)]">older ← → newer</p></div><HistoryBar history={history} slots={90} height={14} /></div></>}
          {!loading && history.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2"><TrendingUp size={13} className="text-[var(--text-tertiary)]" /><p className="text-[12px] font-medium text-[var(--text-secondary)]">Recent checks</p></div>
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead><tr className="bg-[var(--surface)]">{["Status", "Response", "Code", "Time"].map(h => <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--text-tertiary)] tracking-wide">{h.toUpperCase()}</th>)}</tr></thead>
                  <tbody>{history.slice(0, 15).map((c, i) => (<tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-[var(--surface)]"}><td className="px-4 py-2"><span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: c.status === "up" ? "#16a34a" : "#dc2626" }}>{c.status === "up" ? <CheckCircle size={11} /> : <XCircle size={11} />}{c.status.toUpperCase()}</span></td><td className="px-4 py-2 text-[var(--text-primary)]">{c.responseMs != null ? `${c.responseMs}ms` : "—"}</td><td className="px-4 py-2 text-[var(--text-secondary)]">{c.statusCode ?? "—"}</td><td className="px-4 py-2 text-[var(--text-secondary)]">{new Date(c.checkedAt).toLocaleString()}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          )}
          {!loading && history.length === 0 && <div className="flex items-center gap-2 py-6 justify-center text-[var(--text-tertiary)]"><AlertCircle size={16} /><span className="text-[14px]">No checks yet.</span></div>}
        </div>
      </div>
    </div>
  );
}

function MonitorCard({ monitor, onDelete, onCheck, onSelect, checking }: { monitor: MonitorData; onDelete: (id: string) => void; onCheck: (id: string) => void; onSelect: (m: MonitorData) => void; checking: boolean }) {
  const hostname = (() => { try { return new URL(monitor.url).hostname; } catch { return monitor.url; } })();
  return (
    <div onClick={() => onSelect(monitor)} className="group bg-white rounded-2xl p-5 card-hover border border-[var(--border)] cursor-pointer" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <StatusDot status={monitor.status} />
          <div className="min-w-0">
            <p className="font-semibold text-[15px] text-[var(--text-primary)] leading-snug truncate">{monitor.name}</p>
            <a href={monitor.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] flex items-center gap-0.5 truncate"><ArrowUpRight size={10} className="shrink-0" />{hostname}</a>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={e => { e.stopPropagation(); onCheck(monitor.id); }} disabled={checking} title="Check now" className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface)] transition-colors disabled:opacity-40"><RefreshCw size={13} className={checking ? "animate-spin" : ""} /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(monitor.id); }} title="Delete" className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pb-4 border-b border-[var(--border)]">
        {[{ label: "Response", value: monitor.responseMs != null ? `${monitor.responseMs}ms` : "—" }, { label: "Uptime", value: monitor.uptime != null ? `${monitor.uptime}%` : "—" }, { label: "Checked", value: monitor.checkedAt ? timeAgo(monitor.checkedAt) : "Never" }].map(({ label, value }) => (
          <div key={label}><p className="text-[11px] text-[var(--text-tertiary)] mb-0.5">{label}</p><p className="text-[14px] font-semibold text-[var(--text-primary)]">{value}</p></div>
        ))}
      </div>
      <div className="pt-3"><HistoryBar history={monitor.history} slots={30} height={14} /></div>
      {monitor.history.length > 0 && <div className="mt-2 -mx-1"><ResponseSparkline history={monitor.history} /></div>}
    </div>
  );
}

function AddMonitorModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState(""); const [url, setUrl] = useState(""); const [interval, setIntervalVal] = useState(5); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch("/api/monitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, url, interval }) });
      if (!res.ok) throw new Error("failed");
      onAdded(); onClose();
    } catch { setError("Something went wrong. Check the URL and try again."); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(4px)" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)] mb-5">Add Monitor</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[{ label: "Name", value: name, set: setName, ph: "My Website" }, { label: "URL", value: url, set: setUrl, ph: "https://example.com" }].map(({ label, value, set, ph }) => (
            <div key={label}><label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">{label}</label><input value={value} onChange={e => set(e.target.value)} placeholder={ph} required className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-strong)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all bg-[var(--surface)]" /></div>
          ))}
          <div><label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">Check interval</label><select value={interval} onChange={e => setIntervalVal(Number(e.target.value))} className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-strong)] text-[14px] text-[var(--text-primary)] outline-none focus:border-blue-300 transition-all bg-[var(--surface)]"><option value={1}>Every 1 minute</option><option value={5}>Every 5 minutes</option><option value={10}>Every 10 minutes</option><option value={30}>Every 30 minutes</option></select></div>
          {error && <p className="text-[13px] text-red-500">{error}</p>}
          <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-strong)] text-[14px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface)]">Cancel</button><button type="submit" disabled={loading} className="flex-1 btn-primary">{loading ? "Adding…" : "Add Monitor"}</button></div>
        </form>
      </div>
    </div>
  );
}

export default function UptimePage() {
  const [monitors, setMonitors] = useState<MonitorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<MonitorData | null>(null);
  const [checking, setChecking] = useState<Record<string, boolean>>({});

  const fetchMonitors = useCallback(async () => {
    try { const res = await fetch("/api/monitors"); setMonitors(await res.json()); } finally { setLoading(false); }
  }, []);
  const checkAll = useCallback(async () => { await fetch("/api/monitors/check-all", { method: "POST" }); await fetchMonitors(); }, [fetchMonitors]);

  useEffect(() => { fetchMonitors().then(() => checkAll()); const iv = setInterval(fetchMonitors, 60000); return () => clearInterval(iv); }, [fetchMonitors, checkAll]);

  async function handleCheck(id: string) {
    setChecking(p => ({ ...p, [id]: true }));
    try { await fetch(`/api/monitors/${id}/check`, { method: "POST" }); await fetchMonitors(); } finally { setChecking(p => ({ ...p, [id]: false })); }
  }
  async function handleDelete(id: string) {
    if (!confirm("Delete this monitor?")) return;
    await fetch(`/api/monitors/${id}`, { method: "DELETE" });
    setMonitors(p => p.filter(m => m.id !== id));
    if (selectedMonitor?.id === id) setSelectedMonitor(null);
  }

  const upCount = monitors.filter(m => m.status === "up").length;
  const downCount = monitors.filter(m => m.status === "down").length;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1"><Radio size={18} className="text-[var(--text-secondary)]" /><h1 className="text-[22px] font-bold text-[var(--text-primary)] tracking-tight">Uptime Monitor</h1></div>
          <p className="text-[13px] text-[var(--text-secondary)]">Track HTTP uptime, response time, and availability</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5"><Plus size={14} />Add Monitor</button>
      </div>

      {monitors.length > 0 && (
        <div className="flex items-center gap-5 mb-6">
          <div className="flex items-center gap-2"><Activity size={14} className="text-[var(--text-tertiary)]" /><span className="text-[13px] text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-primary)]">{monitors.length}</span> monitors</span></div>
          <div className="flex items-center gap-1.5"><CheckCircle size={13} style={{ color: "var(--status-up)" }} /><span className="text-[13px]"><span className="font-semibold" style={{ color: "var(--status-up)" }}>{upCount}</span> up</span></div>
          {downCount > 0 && <div className="flex items-center gap-1.5"><XCircle size={13} style={{ color: "var(--status-down)" }} /><span className="text-[13px]"><span className="font-semibold" style={{ color: "var(--status-down)" }}>{downCount}</span> down</span></div>}
          <div className="flex items-center gap-1.5 ml-auto"><Clock size={11} className="text-[var(--text-tertiary)]" /><span className="text-[11px] text-[var(--text-tertiary)]">Auto-refresh 60s</span></div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><RefreshCw size={20} className="animate-spin text-[var(--text-tertiary)]" /></div>
      ) : monitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-[var(--border)] flex items-center justify-center mb-4" style={{ boxShadow: "var(--shadow-card)" }}><Radio size={24} className="text-[var(--text-tertiary)]" /></div>
          <h2 className="text-[17px] font-semibold text-[var(--text-primary)] mb-2">No monitors yet</h2>
          <p className="text-[13px] text-[var(--text-secondary)] mb-5 max-w-xs">Add a URL to start monitoring uptime and response time.</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5"><Plus size={14} />Add Monitor</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {monitors.map(m => <MonitorCard key={m.id} monitor={m} onDelete={handleDelete} onCheck={handleCheck} onSelect={setSelectedMonitor} checking={!!checking[m.id]} />)}
        </div>
      )}

      {showAdd && <AddMonitorModal onClose={() => setShowAdd(false)} onAdded={fetchMonitors} />}
      {selectedMonitor && <MonitorDetailModal monitor={selectedMonitor} onClose={() => setSelectedMonitor(null)} />}
    </div>
  );
}
