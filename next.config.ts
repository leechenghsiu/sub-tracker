import type { NextConfig } from "next";

// 加入 next-pwa 設定
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
});

const nextConfig: import('next').NextConfig = {
  /* config options here */
};

module.exports = withPWA(nextConfig);
