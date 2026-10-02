import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-tools badge sits bottom-left, which is exactly where the sidebar
  // keeps Sign out. It never ships to production, but it covers a real button
  // the whole time we are building. Compile and runtime errors still surface.
  devIndicators: false,
};

export default nextConfig;
