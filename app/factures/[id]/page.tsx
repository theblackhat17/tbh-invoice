

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Prestation {
  description: string;
  quantite: number;
  prix_unit: number;
}

interface Client {
  nom: string;
  adresse: string;
}

interface Facture {
  id: string;
  numero: string;
  date: string;
  type_document: string;
  total_ht: number;
  client: Client;
  prestations: Prestation[];
}

export default function FactureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [facture, setFacture] = useState<Facture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const id = params?.id as string;

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/factures?id=${id}`);
        
        if (!res.ok) {
          throw new Error('Facture introuvable');
        }
        
        const data = await res.json();
        
        // Si l'API retourne un tableau, prendre le premier élément
        const factureData = Array.isArray(data) ? data[0] : data;
        
        if (!factureData) {
          throw new Error('Facture introuvable');
        }
        
        setFacture(factureData);
      } catch (err: any) {
        console.error('Erreur chargement facture:', err);
        setError(err.message || 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-zinc-500">Chargement...</p>
      </div>
    );
  }

  if (error || !facture) {
    return (
      <div className="py-20 text-center">
        <p className="text-zinc-500 mb-4">{error || 'Facture introuvable.'}</p>
        <Link href="/factures" className="btn-primary">← Retour aux factures</Link>
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto glass p-10 rounded-2xl">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-extrabold mb-2">TBH ONE</h1>
            <p className="text-zinc-500">39 Avenue Émile Zola — Lille</p>
            <p className="text-zinc-500">SIRET : 911 278 992 00019</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold">
              {facture.type_document} N° {facture.numero}
            </h2>
            <p className="text-sm text-zinc-500">
              {new Date(facture.date).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>

        <div className="p-6 bg-zinc-50/70 dark:bg-zinc-800/70 rounded-xl mb-8">
          <h3 className="font-semibold mb-1">Client :</h3>
          <p className="font-medium">{facture.client?.nom || 'Non renseigné'}</p>
          <p className="text-zinc-500">{facture.client?.adresse || ''}</p>
        </div>

        <div className="overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                <th className="text-left py-2 px-4">Description</th>
                <th className="text-center py-2 px-4">Quantité</th>
                <th className="text-right py-2 px-4">Prix unit.</th>
                <th className="text-right py-2 px-4">Total</th>
              </tr>
            </thead>
            <tbody>
              {facture.prestations && facture.prestations.length > 0 ? (
                facture.prestations.map((p, i) => (
                  <tr key={i} className="border-t border-zinc-200 dark:border-zinc-700">
                    <td className="py-2 px-4">{p.description}</td>
                    <td className="py-2 px-4 text-center">{p.quantite}</td>
                    <td className="py-2 px-4 text-right">{p.prix_unit.toFixed(2)} €</td>
                    <td className="py-2 px-4 text-right font-medium">
                      {(p.quantite * p.prix_unit).toFixed(2)} €
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-zinc-500">
                    Aucune prestation
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mb-6">
          <div className="bg-blue-600 text-white px-6 py-3 rounded-lg">
            <p>Total HT</p>
            <p className="text-2xl font-bold">{facture.total_ht.toFixed(2)} €</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button onClick={() => router.back()} className="btn-ghost">
            ← Retour
          </button>
          <a 
            href={`/api/pdf?id=${facture.id}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-primary"
          >
            📥 Télécharger PDF
          </a>
        </div>
      </div>
    </div>
  );
}