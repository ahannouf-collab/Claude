import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  server: {
    host: true,
    port: 5174,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      manifest: false,
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
    }),
  ],
});
