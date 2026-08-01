import type { NextConfig } from "next";

// 加入 next-pwa 設定
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // 本站只需要推播（push handler 在 custom worker，與 precache 無關），
  // 不需要離線快取。清空 precache 清單，避免 workbox 在 install 階段
  // 因某個 precache 檔抓失敗 / iOS PWA 儲存配額不足而導致 SW 安裝失敗
  // （state:redundant、永遠 active 不了）。
  buildExcludes: [/.*/],
});

const nextConfig: import('next').NextConfig = {
  /* config options here */
};

module.exports = withPWA(nextConfig);
