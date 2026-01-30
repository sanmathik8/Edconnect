import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: '**', // Allow external images from CDNs/Cloudinary
      },
    ],
  },
  // env: { NEXT_PUBLIC_API_URL } is NOT needed, Next.js picks it up automatically from .env
};

export default nextConfig;
