'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Facture {
  id: string;
  numero: string;
  date: string;
  typeDocument: string;
  totalHT: number;
  client: { nom: string };
}

export default function FacturesPage() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');

  useEffect(() => { fetchFactures(); }, []);

  const fetchFactures = async () => {
    try {
      const res = await fetch('/api/factures');
      const data = await res.json();
      setFactures(data);
    } catch (e) {
      console.error('Erreur de chargement:', e);
    } finally {
      setLoading(false);
    }
  };

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
        .includes(search.toLowerCase())
    )
    .sort((a, b) =>
      sort === 'asc'
        ? new Date(a.date).getTime() - new Date(b.date).getTime()
        : new Date(b.date).getTime() - new Date(a.date).getTime()
    );

  if (loading) return <div className="text-center py-20">Chargement...</div>;

  return (
    <div className="py-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-4xl font-bold">📄 Factures</h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="🔍 Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setSort(sort === 'asc' ? 'desc' : 'asc')}
            className="btn-ghost"
            title="Changer l’ordre"
          >
            {sort === 'asc' ? '⬆️' : '⬇️'}
          </button>
          <Link href="/factures/nouvelle" className="btn-primary">
            ➕ Nouvelle facture
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          Aucune facture trouvée.
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-zinc-900/40 text-left text-gray-700 dark:text-zinc-200">
              <tr>
                <th className="py-3 px-5">Numéro</th>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Type</th>
                <th className="py-3 px-5">Client</th>
                <th className="py-3 px-5 text-right">Montant HT</th>
                <th className="py-3 px-5 text-center">Actions</th>
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
                  <td className="py-3 px-5 font-medium">{f.numero}</td>
                  <td className="py-3 px-5">{new Date(f.date).toLocaleDateString('fr-FR')}</td>
                  <td className="py-3 px-5">
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
                  <td className="py-3 px-5 text-right font-semibold">{f.totalHT.toFixed(2)} €</td>
                  <td className="py-3 px-5 text-center flex justify-center gap-3">
                    <Link href={`/factures/${f.id}`} className="hover:text-blue-600">👁️</Link>
                    <a href={`/api/pdf?id=${f.id}`} target="_blank" className="hover:text-green-600">📥</a>
                    <button onClick={() => deleteFacture(f.id)} className="hover:text-red-600">🗑️</button>
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
