'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

interface Client {
  id: string;
  nom: string;
  adresse: string;
  email?: string | null;
  telephone?: string | null;
  siret?: string | null;
  created_at?: string | null;
  nbFactures?: number;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/clients');
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Erreur chargement clients', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(
    () =>
      clients.filter((c) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          c.nom.toLowerCase().includes(q) ||
          (c.adresse ?? '').toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q)
        );
      }),
    [clients, search],
  );

  if (loading) {
    return (
      <div className="py-16 text-center text-gray-500">
        Chargement des clients…
      </div>
    );
  }

  return (
    <div className="py-10 container-app">
      {/* Header + actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-extrabold mb-1">👥 Clients</h1>
          <p className="text-gray-500 text-sm">
            {clients.length === 0
              ? "Aucun client enregistré pour l’instant."
              : `${clients.length} client${clients.length > 1 ? 's' : ''} au total`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="🔍 Rechercher par nom, adresse, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
          />

          <Link
            href="/clients/nouveau"
            className="btn-primary flex-1 sm:flex-none text-center justify-center"
          >
            ➕ Nouveau client
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-gray-500">
          Aucun client ne correspond à la recherche.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => {
            const initials = c.nom
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((x) => x[0]?.toUpperCase())
              .join('');
            const nb = c.nbFactures ?? 0;

            return (
              <div
                key={c.id}
                className="glass rounded-2xl p-5 flex flex-col justify-between h-full border border-zinc-200/60 dark:border-zinc-700/60"
              >
                {/* En-tête client */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-700 flex items-center justify-center font-semibold text-sm">
                    {initials || '??'}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold">{c.nom}</h2>
                    <p className="text-xs text-gray-500">
                      🧾 {nb} facture{nb > 1 ? 's' : ''}
                    </p>
                    {c.siret && (
                      <p className="text-xs text-gray-500">
                        SIRET&nbsp;: <span className="font-mono">{c.siret}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Infos */}
                <div className="space-y-2 text-sm mb-4">
                  {c.adresse && (
                    <p className="flex gap-2">
                      <span className="text-gray-400">📍</span>
                      <span>{c.adresse}</span>
                    </p>
                  )}
                  {c.email && (
                    <p className="flex gap-2">
                      <span className="text-gray-400">✉️</span>
                      <a
                        href={`mailto:${c.email}`}
                        className="text-blue-600 hover:underline break-all"
                      >
                        {c.email}
                      </a>
                    </p>
                  )}
                  {c.telephone && (
                    <p className="flex gap-2">
                      <span className="text-gray-400">📞</span>
                      <a
                        href={`tel:${c.telephone}`}
                        className="text-gray-800 dark:text-gray-200"
                      >
                        {c.telephone}
                      </a>
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60">
                  <Link
                    href={`/factures?clientId=${c.id}`}
                    className="btn-ghost text-xs flex-1 justify-center"
                    title="Voir les factures de ce client"
                  >
                    📄 Factures
                  </Link>
                  <Link
                    href={`/factures/nouvelle?clientId=${c.id}`}
                    className="btn-primary text-xs flex-1 justify-center"
                    title="Créer une facture pour ce client"
                  >
                    ➕ Nouvelle facture
                  </Link>
                  <Link
                    href={`/clients/${c.id}`}
                    className="btn-ghost text-xs flex-1 justify-center"
                    title="Modifier ce client"
                  >
                    ✏️ Modifier
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
