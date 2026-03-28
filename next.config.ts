import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@tensorflow/tfjs-core",
    "@tensorflow/tfjs-backend-webgl",
    "@tensorflow-models/pose-detection",
    "@mediapipe/pose",
  ],
  turbopack: {
    resolveAlias: {
      "@mediapipe/pose": "./src/lib/mediapipe-stub.js",
    },
  },
};

export default nextConfig;
