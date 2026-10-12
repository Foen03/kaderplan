import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kaderplan",
    short_name: "Kaderplan",
    description: "Trainingszusagen und Anwesenheit für deine Mannschaft",
    start_url: "/",
    display: "standalone",
    background_color: "#eef2f0",
    theme_color: "#2147a8",
    lang: "de",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
