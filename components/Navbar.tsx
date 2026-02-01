'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // L'utilisateur est authentifié via cookie, pas besoin de fetch ici
    // Si tu veux afficher l'email, ajoute un endpoint /api/auth/me
    setUser({ email: 'admin@tbhone.com' }); // Placeholder
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          TBH Invoice
        </Link>
        <div className="flex gap-4 items-center">
          <Link href="/clients">Clients</Link>
          <Link href="/factures">Factures</Link>
          <Link href="/devis">Devis</Link>
          <Link href="/parametres">Paramètres</Link>
          {user && <span className="text-sm">{user.email}</span>}
          <button onClick={handleLogout} className="bg-red-600 px-4 py-2 rounded">
            Déconnexion
          </button>
        </div>
      </div>
    </nav>
  );
}
