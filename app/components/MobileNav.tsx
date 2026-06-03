"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Zap, History, Globe, MessageSquare, Radio, MoreHorizontal } from "lucide-react";
import { useState } from "react";

const PRIMARY_NAV = [
  { href: "/", icon: LayoutDashboard, label: "Home" },
  { href: "/speed-test", icon: Zap, label: "Speed" },
  { href: "/history", icon: History, label: "History" },
  { href: "/connections", icon: Globe, label: "DNS" },
  { href: "/copilot", icon: MessageSquare, label: "AI" },
];

const MORE_NAV = [
  { href: "/insights", label: "AI Insights" },
  { href: "/uptime", label: "Uptime" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* Bottom tab bar — mobile only */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/90 border-t border-[var(--border)]"
        style={{ backdropFilter: "blur(12px)", boxShadow: "0 -4px 24px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center">
          {PRIMARY_NAV.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
                style={{ color: active ? "#7C3AED" : "var(--text-tertiary)" }}
              >
                <div className="relative">
                  <Icon size={22} />
                  {href === "/copilot" && (
                    <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-gradient-to-r from-blue-400 to-violet-500 flex items-center justify-center">
                      <span className="text-[6px] text-white font-bold">AI</span>
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-medium">{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
            style={{ color: MORE_NAV.some(n => pathname.startsWith(n.href)) ? "#7C3AED" : "var(--text-tertiary)" }}
          >
            <MoreHorizontal size={22} />
            <span className="text-[9px] font-medium">More</span>
          </button>
        </div>

        {/* More menu popup */}
        {showMore && (
          <div
            className="absolute bottom-full right-2 mb-2 bg-white rounded-2xl border border-[var(--border)] overflow-hidden"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)", minWidth: 160 }}
          >
            {MORE_NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setShowMore(false)}
                className="flex items-center px-4 py-3 text-[14px] font-medium border-b border-[var(--border)] last:border-b-0"
                style={{ color: pathname.startsWith(href) ? "#7C3AED" : "var(--text-primary)" }}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Tap outside to close More */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-20" onClick={() => setShowMore(false)} />
      )}
    </>
  );
}
