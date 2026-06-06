import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PulseNet — AI Network Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient glow left — cyan */}
        <div style={{ position: "absolute", top: -80, left: -80, width: 500, height: 500, background: "radial-gradient(ellipse, rgba(96,165,250,0.18) 0%, transparent 65%)", borderRadius: "50%", filter: "blur(60px)" }} />
        {/* Ambient glow right — purple */}
        <div style={{ position: "absolute", bottom: -60, right: -60, width: 420, height: 420, background: "radial-gradient(ellipse, rgba(167,139,250,0.22) 0%, transparent 65%)", borderRadius: "50%", filter: "blur(50px)" }} />
        {/* Center glow */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 300, background: "radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)", filter: "blur(40px)" }} />

        {/* Main content row */}
        <div style={{ display: "flex", alignItems: "center", gap: 72, position: "relative" }}>

          {/* PulseNet icon */}
          <div style={{
            width: 180,
            height: 180,
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
            borderRadius: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 1px rgba(139,92,246,0.35), 0 24px 64px rgba(96,165,250,0.25), 0 24px 64px rgba(167,139,250,0.2)",
          }}>
            <svg width="110" height="110" viewBox="0 0 100 100" fill="none">
              <defs>
                <linearGradient id="sig" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="100%" stopColor="#A78BFA" />
                </linearGradient>
              </defs>
              {/* Outer arc */}
              <path d="M 22 58 A 30 30 0 0 1 78 58" stroke="url(#sig)" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.7" />
              {/* Mid arc */}
              <path d="M 30 63 A 20 20 0 0 1 70 63" stroke="url(#sig)" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.85" />
              {/* Inner arc */}
              <path d="M 38 68 A 12 12 0 0 1 62 68" stroke="url(#sig)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              {/* Center dot */}
              <circle cx="50" cy="68" r="5" fill="url(#sig)" />
              {/* Pulse line up */}
              <path d="M 50 63 L 50 52" stroke="url(#sig)" strokeWidth="4" strokeLinecap="round" />
              {/* Waveform */}
              <path d="M 32 44 L 38 44 L 41 36 L 44 52 L 47 40 L 50 48 L 53 44 L 68 44" stroke="url(#sig)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>

          {/* Vertical divider */}
          <div style={{ width: 2, height: 180, background: "linear-gradient(to bottom, transparent, rgba(96,165,250,0.4) 40%, rgba(167,139,250,0.4) 60%, transparent)" }} />

          {/* Text content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* App name */}
            <div style={{
              fontSize: 88,
              fontWeight: 900,
              letterSpacing: "-0.01em",
              background: "linear-gradient(135deg, #93c5fd 0%, #c4b5fd 100%)",
              backgroundClip: "text",
              color: "transparent",
              lineHeight: 1,
            }}>
              PulseNet
            </div>
            {/* Subtitle */}
            <div style={{ fontSize: 22, fontWeight: 600, color: "rgba(200,220,255,0.7)", letterSpacing: "0.04em" }}>
              AI Network Intelligence
            </div>
            {/* Badges row */}
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", background: "rgba(139,92,246,0.15)", padding: "7px 16px", borderRadius: 100, border: "1px solid rgba(139,92,246,0.3)" }}>
                ⚡ Groq · Llama 3.3
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", background: "rgba(96,165,250,0.1)", padding: "7px 16px", borderRadius: 100, border: "1px solid rgba(96,165,250,0.25)" }}>
                📡 Real-time Analysis
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399", background: "rgba(52,211,153,0.1)", padding: "7px 16px", borderRadius: 100, border: "1px solid rgba(52,211,153,0.25)" }}>
                ● AI Active
              </div>
            </div>
            {/* MSRX attribution */}
            <div style={{ fontSize: 14, color: "rgba(200,220,255,0.35)", marginTop: 2, letterSpacing: "0.12em", fontWeight: 600, textTransform: "uppercase" }}>
              by MSRX · pulsenet.msrx.co.in
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
