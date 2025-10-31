"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Accueil", icon: "🏠" },
  { href: "/factures", label: "Factures", icon: "📄" },
  { href: "/clients", label: "Clients", icon: "👥" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname?.startsWith(href));

  return (
    <header className="sticky top-0 z-40">
      <nav className="glass border-0 shadow-sm">
        <div className="container-app h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight">
              TBH <span className="text-blue-500">ONE</span>
            </span>
            <span className="text-xs text-zinc-400 hidden sm:inline">Invoice</span>
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link ${isActive(l.href) ? "nav-link-active" : ""}`}
              >
                <span className="mr-1">{l.icon}</span>
                {l.label}
              </Link>
            ))}
            <Link href="/factures/nouvelle" className="btn-primary ml-2">
              ➕ Nouvelle facture
            </Link>
            <Link href="/clients/nouveau" className="btn-success">
              ➕ Nouveau client
            </Link>
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden btn-ghost"
            aria-label="Ouvrir le menu"
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>
        </div>

        {/* Mobile menu panel */}
        {open && (
          <div className="md:hidden border-t border-zinc-800/40">
            <div className="container-app py-3 flex flex-col gap-2">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`nav-link ${isActive(l.href) ? "nav-link-active" : ""}`}
                >
                  <span className="mr-1">{l.icon}</span>
                  {l.label}
                </Link>
              ))}
              <div className="flex gap-2 pt-2">
                <Link href="/factures/nouvelle" onClick={() => setOpen(false)} className="btn-primary flex-1 text-center">
                  ➕ Nouvelle facture
                </Link>
                <Link href="/clients/nouveau" onClick={() => setOpen(false)} className="btn-success flex-1 text-center">
                  ➕ Nouveau client
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
