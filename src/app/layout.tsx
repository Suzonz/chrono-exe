import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StatusBanner } from "@/components/layout/StatusBanner";
import { LiveProvider } from "@/components/providers/LiveProvider";
import "../styles/globals.css";

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap"
});

// Readable pixel font for sentences and lists; Press Start 2P stays for titles and numbers.
const readFont = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-read",
  display: "swap"
});

export const metadata: Metadata = {
  title: { default: "CHRONO.EXE", template: "%s // CHRONO.EXE" },
  description: "See where your screen time goes: automatic tracking, top sites, productivity score."
};

export const viewport: Viewport = {
  themeColor: "#15121b"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${pixelFont.variable} ${readFont.variable}`}>
      <body className="bg-background font-pixel text-on-background antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:bg-primary-container focus:p-sm focus:text-label"
        >
          SKIP TO CONTENT
        </a>
        <div className="scanline-overlay" aria-hidden />
        <LiveProvider>
          <Sidebar />
          <Header />
          <main id="main" className="min-h-screen bg-surface-dim px-md pb-[56px] pt-[104px] md:ml-[220px] md:px-container-margin md:pt-[68px]">
            <StatusBanner />
            {children}
          </main>
          <Footer />
        </LiveProvider>
      </body>
    </html>
  );
}
