export default function manifest() {
  return {
    name: "SubTracker",
    short_name: "SubTracker",
    description: "Track your subscriptions and manage your finances",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png"
      },
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  }
}
