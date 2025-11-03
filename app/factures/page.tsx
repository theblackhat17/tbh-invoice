'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface Facture {
  id: string;
  numero: string;
  date: string;
  typeDocument: string;
  totalHT: number;
  clientId?: string;
  client: { nom: string };
}

export default function FacturesPage() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');

  const searchParams = useSearchParams({ suspense: false });
  const clientIdFilter = searchParams?.get('clientId');

  const fetchFactures = async () => {
    try {
      const url = clientIdFilter
        ? `/api/factures?clientId=${clientIdFilter}`
        : '/api/factures';
      const res = await fetch(url);
      const data = await res.json();
      setFactures(data);
    } catch (e) {
      console.error('Erreur de chargement:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFactures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientIdFilter]);

  const deleteFacture = async (id: string) => {
    if (!confirm('Supprimer cette facture ?')) return;
    await fetch(`/api/factures?id=${id}`, { method: 'DELETE' });
    fetchFactures();
  };

  const filtered = factures
    .filter((f) =>
      [f.numero, f.client.nom, f.typeDocument]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'asc'
        ? new Date(a.date).getTime() - new Date(b.date).getTime()
        : new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

  if (loading)
    return <div className="text-center py-20">Chargement...</div>;

  return (
    <div className="py-10 container-app">
      {/* Header + filtres */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h1 className="text-4xl font-bold">📄 Factures</h1>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="🔍 Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={() => setSort(sort === 'asc' ? 'desc' : 'asc')}
              className="btn-ghost flex-1 sm:flex-none"
              title="Changer l’ordre"
            >
              {sort === 'asc'
                ? '⬆️ Plus anciennes'
                : '⬇️ Plus récentes'}
            </button>

            <Link
              href="/factures/nouvelle"
              className="btn-primary flex-1 sm:flex-none text-center justify-center"
            >
              ➕ Nouvelle facture
            </Link>
          </div>
        </div>
      </div>

      {clientIdFilter && factures.length > 0 && (
        <p className="text-sm text-gray-500 mb-4">
          Factures pour&nbsp;
          <span className="font-semibold">
            {factures[0].client.nom}
          </span>
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          Aucune facture trouvée.
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm">
            <thead className="bg-gray-100 dark:bg-zinc-900/40 text-left text-gray-700 dark:text-zinc-200">
              <tr>
                <th className="py-3 px-5">Numéro</th>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Type</th>
                <th className="py-3 px-5">Client</th>
                <th className="py-3 px-5 text-right whitespace-nowrap">
                  Montant HT
                </th>
                <th className="py-3 px-5 text-center whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr
                  key={f.id}
                  className={`border-t border-zinc-200/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 ${
                    i % 2 ? 'bg-zinc-50/40 dark:bg-zinc-900/20' : ''
                  }`}
                >
                  <td className="py-3 px-5 font-medium whitespace-nowrap">
                    {f.numero}
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap">
                    {new Date(f.date).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        f.typeDocument === 'Facture'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {f.typeDocument}
                    </span>
                  </td>
                  <td className="py-3 px-5">{f.client.nom}</td>
                  <td className="py-3 px-5 text-right font-semibold whitespace-nowrap">
                    {f.totalHT.toFixed(2)} €
                  </td>
                  <td className="py-3 px-5 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <Link
                        href={`/factures/${f.id}`}
                        className="hover:text-blue-600"
                        title="Voir la facture"
                      >
                        👁️
                      </Link>
                      <Link
                        href={`/factures/${f.id}/edit`}
                        className="hover:text-amber-600"
                        title="Modifier la facture"
                      >
                        ✏️
                      </Link>
                      <a
                        href={`/api/pdf?id=${f.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-green-600"
                        title="Télécharger le PDF"
                      >
                        📥
                      </a>
                      <button
                        onClick={() => deleteFacture(f.id)}
                        className="hover:text-red-600"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
