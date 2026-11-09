import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moura Gestão",
    short_name: "Moura",
    description: "Gestão de obras, medições e financeiro da Moura Fundações",
    start_url: "/",
    display: "standalone",
    lang: "pt-BR",
    background_color: "#fafaf9",
    theme_color: "#b45309",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
