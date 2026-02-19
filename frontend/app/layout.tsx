import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Sidebar from "@/components/layout/sidebar";

export const metadata: Metadata = {
  title: "Gong AI Operating Model",
  description: "AI Governance, Discovery & Onboarding POC Portfolio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden">
        <Providers>
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 lg:p-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
