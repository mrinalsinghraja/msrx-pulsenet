import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 0, // dashboard and other pages always re-mount on navigation
      static: 300,
    },
  },
};

export default nextConfig;
