import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const isDev = process.env.NODE_ENV === "development";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  customWorkerDir: "worker",
  disable: isDev,
});

const nextConfig: NextConfig = {
};

export default withPWA(nextConfig);
