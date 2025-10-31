'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Prestation {
  description: string;
  quantite: number;
  prixUnit: number;
}

interface Facture {
  id: string;
  numero: string;
  date: string;
  typeDocument: string;
  totalHT: number;
  client: { nom: string; adresse: string };
  prestations: Prestation[];
}

export default function FactureDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [facture, setFacture] = useState<Facture | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/factures');
      const data = await res.json();
      setFacture(data.find((f: Facture) => f.id === id) || null);
    })();
  }, [id]);

  if (!facture)
    return (
      <div className="py-20 text-center">
        <p className="text-zinc-500 mb-4">Facture introuvable.</p>
        <Link href="/factures" className="btn-primary">Retour</Link>
      </div>
    );

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
            <h2 className="text-2xl font-bold">{facture.typeDocument} N° {facture.numero}</h2>
            <p className="text-sm text-zinc-500">
              {new Date(facture.date).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>

        <div className="p-6 bg-zinc-50/70 rounded-xl mb-8">
          <h3 className="font-semibold mb-1">Client :</h3>
          <p className="font-medium">{facture.client.nom}</p>
          <p className="text-zinc-500">{facture.client.adresse}</p>
        </div>

        <div className="overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="text-left py-2 px-4">Description</th>
                <th className="text-center py-2 px-4">Quantité</th>
                <th className="text-right py-2 px-4">Prix unit.</th>
                <th className="text-right py-2 px-4">Total</th>
              </tr>
            </thead>
            <tbody>
              {facture.prestations.map((p, i) => (
                <tr key={i} className="border-t border-zinc-200">
                  <td className="py-2 px-4">{p.description}</td>
                  <td className="py-2 px-4 text-center">{p.quantite}</td>
                  <td className="py-2 px-4 text-right">{p.prixUnit.toFixed(2)} €</td>
                  <td className="py-2 px-4 text-right font-medium">
                    {(p.quantite * p.prixUnit).toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mb-6">
          <div className="bg-blue-600 text-white px-6 py-3 rounded-lg">
            <p>Total HT</p>
            <p className="text-2xl font-bold">{facture.totalHT.toFixed(2)} €</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button onClick={() => router.back()} className="btn-ghost">← Retour</button>
          <a href={`/api/pdf?id=${facture.id}`} target="_blank" className="btn-primary">
            📥 Télécharger PDF
          </a>
        </div>
      </div>
    </div>
  );
}
