import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";

import { Providers } from "@/components/Providers";

import "./globals.css";

/** Texto corrido: Barlow normal, aberta e legível em telas pequenas. */
const sans = Barlow({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-barlow",
});

/** Títulos, rótulos e botões: Barlow Condensed pesada. Nunca em texto corrido. */
const display = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  title: "Moura Gestão",
  description: "Gestão de obras, medições e financeiro da Moura Fundações",
  appleWebApp: { capable: true, title: "Moura" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#8b1c31",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
