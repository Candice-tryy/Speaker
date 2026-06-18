import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Speaking · 雅思口语练习",
    short_name: "Speaking",
    description: "卡片练习 + 登山闯关的雅思口语练习",
    start_url: "/map",
    display: "standalone",
    orientation: "portrait",
    background_color: "#D9F0FF",
    theme_color: "#3FC196",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
