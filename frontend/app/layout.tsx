import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Sidebar from "@/components/layout/sidebar";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gong AI Operating Model",
  description: "AI Governance, Discovery & Onboarding POC Portfolio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="flex h-screen overflow-hidden bg-dot-grid">
        <Providers>
          <Sidebar />
          <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
            <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
              {children}
            </div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
