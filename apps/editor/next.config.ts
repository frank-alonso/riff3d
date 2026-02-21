import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile workspace packages that use source-based exports
  transpilePackages: ["@riff3d/ecson", "@riff3d/fixtures"],

  // Allow Supabase avatar images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
    ],
  },
};

export default nextConfig;
