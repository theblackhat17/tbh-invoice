'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Devis {
  id: string;
  numero: string;
  date: string;
  totalHT: number;
  status: string;
  clientId?: string;
  client: { nom: string };
}

export default function DevisPage() {
  return (
    <Suspense fallback={<div className="text-center py-20">Chargement…</div>}>
      <DevisPageInner />
    </Suspense>
  );
}

function DevisPageInner() {
  const [devis, setDevis] = useState<Devis[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');
  const router = useRouter();

  const searchParams = useSearchParams();
  const clientIdFilter = searchParams?.get('clientId');

  const fetchDevis = async () => {
    try {
      const url = clientIdFilter
        ? `/api/devis?clientId=${clientIdFilter}`
        : '/api/devis';
      const res = await fetch(url);
      const data = await res.json();
      setDevis(data);
    } catch (e) {
      console.error('Erreur de chargement:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientIdFilter]);

  const deleteDevis = async (id: string) => {
    if (!confirm('Supprimer ce devis ?')) return;
    await fetch(`/api/devis?id=${id}`, { method: 'DELETE' });
    fetchDevis();
  };

  const convertDevisToFacture = async (devisId: string) => {
    if (!confirm('Convertir ce devis en facture ? Cette action est irréversible.')) return;

    try {
      // 1. Get full devis data
      const resDevis = await fetch(`/api/devis?id=${devisId}`);
      if (!resDevis.ok) throw new Error('Impossible de récupérer les données du devis.');
      const devisData = await resDevis.json();

      // 2. Create new facture
      const resFacture = await fetch('/api/factures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeDocument: 'Facture',
          date: new Date().toISOString().split('T')[0],
          clientId: devisData.clientId,
          prestations: devisData.prestations,
          totalHT: devisData.totalHT,
        }),
      });

      if (!resFacture.ok) throw new Error('La création de la facture a échoué.');
      const newFacture = await resFacture.json();

      // 3. Update devis status
      await fetch(`/api/devis?id=${devisId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Converti' }),
      });

      alert(`Facture ${newFacture.numero} créée avec succès !`);
      router.push('/factures');

    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
      console.error(error);
    }
  };

  const filtered = devis
    .filter((d) =>
      [d.numero, d.client.nom, d.status]
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
        <h1 className="text-4xl font-bold">📝 Devis</h1>

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
              title="Changer l'ordre"
            >
              {sort === 'asc'
                ? '⬆️ Plus anciens'
                : '⬇️ Plus récents'}
            </button>

            <Link
              href="/devis/nouveau"
              className="btn-primary flex-1 sm:flex-none text-center justify-center"
            >
              ➕ Nouveau devis
            </Link>
          </div>
        </div>
      </div>

      {clientIdFilter && devis.length > 0 && (
        <p className="text-sm text-gray-500 mb-4">
          Devis pour&nbsp;
          <span className="font-semibold">
            {devis[0].client.nom}
          </span>
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          Aucun devis trouvé.
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm">
            <thead className="bg-gray-100 dark:bg-zinc-900/40 text-left text-gray-700 dark:text-zinc-200">
              <tr>
                <th className="py-3 px-5">Numéro</th>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Client</th>
                <th className="py-3 px-5">Statut</th>
                <th className="py-3 px-5 text-right whitespace-nowrap">
                  Montant HT
                </th>
                <th className="py-3 px-5 text-center whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr
                  key={d.id}
                  className={`border-t border-zinc-200/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 ${
                    i % 2 ? 'bg-zinc-50/40 dark:bg-zinc-900/20' : ''
                  }`}
                >
                  <td className="py-3 px-5 font-medium whitespace-nowrap">
                    {d.numero}
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap">
                    {new Date(d.date).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-3 px-5">{d.client.nom}</td>
                  <td className="py-3 px-5">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      d.status === 'Converti' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right font-semibold whitespace-nowrap">
                    {d.totalHT.toFixed(2)} €
                  </td>
                  <td className="py-3 px-5 text-center">
                    <div className="flex items-center justify-center gap-3">
                      {/* 👁️ Visualiser le PDF dans un nouvel onglet */}
                      <a
                        href={`/api/pdf?type=devis&id=${d.id}&action=view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600"
                        title="Visualiser le PDF du devis"
                      >
                        👁️
                      </a>
                      {d.status !== 'Converti' && (
                        <button
                          onClick={() => convertDevisToFacture(d.id)}
                          className="hover:text-green-600"
                          title="Convertir en facture"
                        >
                          🔄
                        </button>
                      )}
                      {/* ✏️ Modifier le devis */}
                      <Link
                        href={`/devis/${d.id}/edit`}
                        className="hover:text-amber-600"
                        title="Modifier le devis"
                      >
                        ✏️
                      </Link>
                      {/* 📥 Télécharger le PDF */}
                      <a
                        href={`/api/pdf?type=devis&id=${d.id}&action=download`}
                        className="hover:text-green-600"
                        title="Télécharger le PDF du devis"
                      >
                        📥
                      </a>
                      {/* 🗑️ Supprimer */}
                      <button
                        onClick={() => deleteDevis(d.id)}
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
