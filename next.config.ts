import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phone/LAN testing against the machine's local IP in `next dev`.
  allowedDevOrigins: ["192.168.8.206"],
  async redirects() {
    return [
      {
        source: "/setup",
        destination: "/console",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
