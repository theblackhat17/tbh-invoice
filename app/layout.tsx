import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "TBH Invoice - Gestion de Factures",
  description: "Application de gestion de factures pour TBH ONE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-grid">
        <Navbar />

        <main className="container-app py-8">
          {children}
        </main>

        <footer className="mt-10">
          <div className="container-app">
            <div className="glass rounded-2xl px-6 py-4 text-sm text-zinc-500 flex items-center justify-between">
              <span>© {new Date().getFullYear()} TBH ONE — Facturation</span>
              <span className="hidden sm:block">Made with Next.js + Tailwind</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
