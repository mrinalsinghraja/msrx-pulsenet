"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Zap, MessageSquare, Wrench } from "lucide-react";

const PRIMARY_NAV = [
  { href: "/", icon: LayoutDashboard, label: "Home" },
  { href: "/speed-test", icon: Zap, label: "Speed" },
  { href: "/tools", icon: Wrench, label: "Tools" },
  { href: "/copilot", icon: MessageSquare, label: "AI" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
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
      </div>
    </nav>
  );
}
