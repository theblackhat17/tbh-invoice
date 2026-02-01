'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Facture {
  id: string;
  numero: string;
  date: string;
  typeDocument: string;
  totalHT: number;
  clientNom: string;
  clientAdresse: string;
  clientEmail?: string;
  clientTelephone?: string;
  clientSiret?: string;
  prestations: Array<{
    id: string;
    description: string;
    quantite: number;
    prixUnit: number;
  }>;
}

export default function FactureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [facture, setFacture] = useState<Facture | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFacture = async () => {
      try {
        const res = await fetch(`/api/factures?id=${params.id}`);
        const data = await res.json();
        setFacture(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchFacture();
  }, [params.id]);

  if (loading) return <div className="text-center py-20">Chargement...</div>;
  if (!facture) return <div className="text-center py-20">Facture introuvable</div>;

  const totalHT = facture.prestations.reduce(
    (sum, p) => sum + p.quantite * p.prixUnit,
    0
  );

  return (
    <div className="py-10 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Facture {facture.numero}</h1>
        <div className="flex gap-2">
          <Link href={`/factures/${facture.id}/edit`} className="btn-ghost">
            Modifier
          </Link>
          <Link href="/factures" className="btn-ghost">
            Retour
          </Link>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="text-2xl font-bold mb-4">Informations</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Date</p>
            <p className="font-semibold">{new Date(facture.date).toLocaleDateString('fr-FR')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Type</p>
            <p className="font-semibold">{facture.typeDocument}</p>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="text-2xl font-bold mb-4">Client</h2>
        <p className="font-semibold">{facture.clientNom}</p>
        <p className="text-gray-600">{facture.clientAdresse}</p>
        {facture.clientEmail && <p className="text-gray-600">{facture.clientEmail}</p>}
        {facture.clientTelephone && <p className="text-gray-600">{facture.clientTelephone}</p>}
        {facture.clientSiret && <p className="text-sm text-gray-500">SIRET: {facture.clientSiret}</p>}
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold mb-4">Prestations</h2>
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left py-2 px-4">Description</th>
              <th className="text-center py-2 px-4">Qté</th>
              <th className="text-right py-2 px-4">Prix Unit.</th>
              <th className="text-right py-2 px-4">Total</th>
            </tr>
          </thead>
          <tbody>
            {facture.prestations.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-2 px-4">{p.description}</td>
                <td className="text-center py-2 px-4">{p.quantite}</td>
                <td className="text-right py-2 px-4">{p.prixUnit.toFixed(2)} €</td>
                <td className="text-right py-2 px-4 font-semibold">
                  {(p.quantite * p.prixUnit).toFixed(2)} €
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2">
            <tr>
              <td colSpan={3} className="text-right py-3 px-4 font-bold">Total HT</td>
              <td className="text-right py-3 px-4 font-bold text-xl">
                {totalHT.toFixed(2)} €
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
