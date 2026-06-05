"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  MessageSquare,
  Activity,
  Wrench,
  ExternalLink,
} from "lucide-react";

const NAV = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", ai: true },
  { href: "/speed-test", icon: Zap, label: "Speed Test", ai: true },
  { href: "/tools", icon: Wrench, label: "Tools", ai: false },
  { href: "/copilot", icon: MessageSquare, label: "AI Copilot", ai: true },
];

function PulseNetLogo({ size = 36 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/msrx-logo.svg" width={size} height={size} alt="MSRX PulseNet" style={{ display: "block" }} />
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 shrink-0 bg-white border-r border-[var(--border)] flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 h-16 flex items-center gap-2.5 border-b border-[var(--border)]">
        <PulseNetLogo size={38} />
        <div>
          <p className="font-semibold text-[15px] tracking-tight text-[var(--text-primary)] leading-tight">
            PulseNet
          </p>
          <div className="flex items-center gap-1">
            <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide leading-tight">
              AI Network Intelligence
            </p>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label, ai }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                active
                  ? "bg-gradient-to-r from-blue-50 to-violet-50 text-[#7C3AED] border border-violet-100"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"
              }`}
            >
              <Icon
                size={15}
                className={active ? "text-[#7C3AED]" : "text-[var(--text-tertiary)]"}
              />
              {label}
              {ai && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-400 to-violet-500 text-white">
                  AI
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[var(--border)] space-y-2">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-green-500" />
          <span className="text-[11px] text-[var(--text-tertiary)]">System Active</span>
        </div>
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "linear-gradient(135deg, #60a5fa, #a78bfa)" }} />
            <span className="text-[10px] font-medium" style={{ color: "#8b5cf6" }}>Groq AI · Connected</span>
          </div>
        </div>
        <a
          href="https://msrx.co.in"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium bg-gradient-to-r from-blue-50 to-violet-50 border border-violet-100 text-[#7C3AED] hover:opacity-80 transition-opacity"
        >
          <ExternalLink size={12} />
          <span>MSRX Portal</span>
          <span className="ml-auto text-[9px] bg-gradient-to-r from-blue-400 to-violet-500 text-white px-1.5 py-0.5 rounded-full font-bold">HOME</span>
        </a>
      </div>
    </aside>
  );
}
