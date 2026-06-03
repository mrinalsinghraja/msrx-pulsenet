export type NetworkMetrics = {
  download: number;
  upload: number;
  latency: number;
  jitter: number;
  packetLoss: number;
};

export function calculateScore(m: NetworkMetrics): number {
  let score = 0;

  // Download speed (0-30 pts)
  if (m.download >= 50) score += 30;
  else if (m.download >= 25) score += 24;
  else if (m.download >= 10) score += 18;
  else if (m.download >= 5) score += 10;
  else if (m.download >= 1) score += 4;

  // Upload speed (0-20 pts)
  if (m.upload >= 20) score += 20;
  else if (m.upload >= 10) score += 16;
  else if (m.upload >= 5) score += 10;
  else if (m.upload >= 1) score += 5;

  // Latency (0-25 pts)
  if (m.latency <= 15) score += 25;
  else if (m.latency <= 30) score += 20;
  else if (m.latency <= 60) score += 13;
  else if (m.latency <= 120) score += 6;

  // Jitter (0-15 pts)
  if (m.jitter <= 3) score += 15;
  else if (m.jitter <= 8) score += 10;
  else if (m.jitter <= 20) score += 5;

  // Packet loss (0-10 pts)
  if (m.packetLoss === 0) score += 10;
  else if (m.packetLoss < 0.5) score += 7;
  else if (m.packetLoss < 2) score += 3;

  return Math.min(100, Math.max(0, score));
}

export function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Excellent", color: "#16a34a" };
  if (score >= 75) return { label: "Good", color: "#22c55e" };
  if (score >= 55) return { label: "Fair", color: "#d97706" };
  if (score >= 35) return { label: "Poor", color: "#ef4444" };
  return { label: "Critical", color: "#dc2626" };
}
