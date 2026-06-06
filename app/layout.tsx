import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "PulseNet — AI Network Intelligence",
  description: "AI-powered network intelligence. Real-time speed analysis, diagnostics, and personalised recommendations — powered by Groq AI.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "PulseNet — AI Network Intelligence",
    description: "AI-powered network intelligence. Real-time speed analysis, diagnostics, and personalised recommendations — powered by Groq AI.",
    url: "https://pulsenet.msrx.co.in",
    siteName: "PulseNet by MSRX",
    type: "website",
    images: [{ url: "https://pulsenet.msrx.co.in/opengraph-image", width: 1200, height: 630, alt: "PulseNet — AI Network Intelligence" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PulseNet — AI Network Intelligence",
    description: "AI-powered network intelligence. Real-time speed analysis, diagnostics, and personalised recommendations — powered by Groq AI.",
    images: ["https://pulsenet.msrx.co.in/opengraph-image"],
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
        {/* MSRX signature — fixed bottom-right on every page */}
        <a
          href="https://msrx.co.in"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-20 right-4 md:bottom-5 md:right-5 z-20 pn-no-print flex items-center gap-1.5 opacity-40 hover:opacity-80 transition-opacity"
          title="MSRX"
          style={{ zIndex: 20 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/msrx-logo.svg" width={22} height={22} alt="MSRX" />
          <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", color: "#6e6e73" }}>MSRX</span>
        </a>
      </body>
    </html>
  );
}
