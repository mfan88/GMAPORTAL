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
      {
        source: "/docs/login-and-setup",
        destination: "/docs/login",
        permanent: true,
      },
      {
        source: "/docs/after-an-upload",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/for-parents",
        destination: "/docs",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
