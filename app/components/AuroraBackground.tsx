"use client";

// Mark as client-only so useMemo particles render only on client (fixes hydration mismatch)
import { useMemo, useState, useEffect } from "react";

// Lightweight CSS aurora — 4 animated orbs + 20 twinkling particles
// Matches AuroraBackground.swift + particle logic from LiquidOrb.swift
// Very subtle opacity so it works on the light MSRX theme

const ORB_CONFIGS = [
  { color: "96, 165, 250",  duration: 18, delay: 0,    x: 15, y: 20, size: 500 }, // blue
  { color: "167, 139, 250", duration: 22, delay: -6,   x: 70, y: 60, size: 450 }, // violet
  { color: "34, 211, 238",  duration: 26, delay: -12,  x: 40, y: 80, size: 380 }, // cyan
  { color: "129, 140, 248", duration: 20, delay: -4,   x: 85, y: 15, size: 420 }, // indigo
];

export function AuroraBackground() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const particles = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      id: i,
      x: ((Math.sin(i * 2.4) + 1) / 2) * 100,
      y: ((Math.cos(i * 1.7) + 1) / 2) * 100,
      size: 1.5 + (i % 3) * 0.8,
      duration: 8 + (i % 5) * 3,
      delay: -(i * 1.3),
      opacity: 0.12 + (i % 4) * 0.06,
    })), []);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden
    >
      {/* Aurora orbs */}
      {ORB_CONFIGS.map((orb, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            width: orb.size,
            height: orb.size * 0.7,
            borderRadius: "50%",
            background: `radial-gradient(ellipse, rgba(${orb.color}, 0.07) 0%, rgba(${orb.color}, 0.03) 50%, transparent 70%)`,
            transform: "translate(-50%, -50%)",
            animation: `aurora-drift-${i} ${orb.duration}s ease-in-out ${orb.delay}s infinite alternate`,
            filter: "blur(2px)",
          }}
        />
      ))}

      {/* Twinkling star particles — client-only to avoid hydration mismatch */}
      {mounted && particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "rgba(96, 165, 250, 0.8)",
            animation: `twinkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  );
}
