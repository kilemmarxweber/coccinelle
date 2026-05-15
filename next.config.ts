import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.11.101'],
  /* async redirects() {
    return [
      { source: "/sign-in", destination: "/auth/sign-in", permanent: false },
      { source: "/sign-up", destination: "/auth/sign-up", permanent: false },
    ];
  }, */
};

export default nextConfig;
