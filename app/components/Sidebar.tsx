"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  Globe,
  MessageSquare,
  Activity,
  Wrench,
} from "lucide-react";

const NAV = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/speed-test", icon: Zap, label: "Speed Test" },
  { href: "/connections", icon: Globe, label: "Connections" },
  { href: "/tools", icon: Wrench, label: "Tools" },
  { href: "/copilot", icon: MessageSquare, label: "AI Copilot" },
];

function PulseNetLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="sb-pn" x1="20" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <path d="M 88 62 A 40 40 0 1 1 88 38" stroke="url(#sb-pn)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="88" cy="38" r="5.5" fill="url(#sb-pn)" />
      <path d="M 40 62 A 10 10 0 0 0 60 62" stroke="url(#sb-pn)" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M 32 62 A 18 18 0 0 0 68 62" stroke="url(#sb-pn)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M 24 62 A 26 26 0 0 0 76 62" stroke="url(#sb-pn)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="62" r="5" fill="url(#sb-pn)" />
      <path d="M 50 67 L 50 78" stroke="url(#sb-pn)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 shrink-0 bg-white border-r border-[var(--border)] flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 h-14 flex items-center gap-2.5 border-b border-[var(--border)]">
        <PulseNetLogo size={26} />
        <div>
          <p className="font-semibold text-[15px] tracking-tight text-[var(--text-primary)] leading-tight">
            PulseNet
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide leading-tight">
            AI Network Intelligence
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
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
              {href === "/copilot" && (
                <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-400 to-violet-500 text-white">
                  AI
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-green-500" />
          <span className="text-[11px] text-[var(--text-tertiary)]">System Active</span>
        </div>
        <a
          href="https://msrx.co.in"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mt-1 block transition-colors"
        >
          by MSRX
        </a>
      </div>
    </aside>
  );
}
