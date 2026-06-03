import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "PulseNet — Network Monitor by MSRX",
  description: "Elegant network monitoring. Track uptime, latency, and health at a glance.",
  openGraph: {
    title: "PulseNet — Network Monitor by MSRX",
    description: "Elegant network monitoring. Track uptime, latency, and health at a glance.",
    url: "https://pulsenet.msrx.co.in",
    siteName: "PulseNet by MSRX",
  },
};

import { Sidebar } from "./components/Sidebar";
import { MobileNav } from "./components/MobileNav";
import { AuroraBackground } from "./components/AuroraBackground";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex h-screen bg-[var(--surface)] overflow-hidden">
        <AuroraBackground />
        <Sidebar />
        <MobileNav />
        {/* pb-16 on mobile = space above bottom nav; none on desktop (md:pb-0) */}
        <div className="relative flex-1 overflow-y-auto pb-16 md:pb-0" style={{ zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
