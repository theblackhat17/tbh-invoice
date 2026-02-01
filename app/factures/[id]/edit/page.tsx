'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Prestation {
  description: string;
  quantite: number;
  prixUnit: number;
}

export default function EditFacturePage() {
  const params = useParams();
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [form, setForm] = useState({
    typeDocument: 'Facture',
    date: '',
    clientId: '',
  });
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [factureRes, clientsRes] = await Promise.all([
          fetch(`/api/factures?id=${params.id}`),
          fetch('/api/clients'),
        ]);
        
        const factureData = await factureRes.json();
        const clientsData = await clientsRes.json();

        setForm({
          typeDocument: factureData.typeDocument,
          date: factureData.date,
          clientId: factureData.clientId,
        });
        setPrestations(factureData.prestations || []);
        setClients(Array.isArray(clientsData) ? clientsData : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  const handleChange = (i: number, field: keyof Prestation, value: any) => {
    setPrestations((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p))
    );
  };

  const addLine = () =>
    setPrestations((p) => [...p, { description: '', quantite: 1, prixUnit: 0 }]);

  const removeLine = (i: number) =>
    prestations.length > 1 && setPrestations((p) => p.filter((_, x) => x !== i));

  const totalHT = prestations.reduce((t, p) => t + p.quantite * p.prixUnit, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/factures?id=${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          prestations,
          totalHT,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        setErrorMsg(`Erreur serveur (${res.status}). ${body}`.trim());
        return;
      }

      alert('Facture modifiée avec succès !');
      router.push('/factures');
    } catch (err: any) {
      setErrorMsg(`Erreur réseau : ${err?.message ?? err}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-20">Chargement...</div>;

  return (
    <div className="py-10 max-w-5xl mx-auto">
      <h1 className="text-4xl font-extrabold mb-8">Modifier Facture</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="border border-red-400 bg-red-50 text-red-700 rounded-xl p-3">
            {errorMsg}
          </div>
        )}

        <div className="card">
          <h2 className="text-2xl font-bold mb-4">Informations générales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Client *</label>
              <select
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="">Sélectionner un client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Prestations</h2>
            <button type="button" onClick={addLine} className="btn-primary text-sm">
              Ajouter une ligne
            </button>
          </div>

          {prestations.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-4 items-end mb-3">
              <div className="col-span-6">
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={p.description}
                  onChange={(e) => handleChange(i, 'description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Qté</label>
                <input
                  type="number"
                  min="0"
                  value={p.quantite}
                  onChange={(e) => handleChange(i, 'quantite', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Prix unit.</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={p.prixUnit}
                  onChange={(e) => handleChange(i, 'prixUnit', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="col-span-1">
                <label className="text-sm font-medium mb-1">Total</label>
                <div className="px-3 py-2 bg-gray-200 rounded-lg text-center font-semibold">
                  {(p.quantite * p.prixUnit).toFixed(2)} €
                </div>
              </div>

              <div className="col-span-1 flex justify-center items-end">
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={prestations.length === 1}
                  className="text-red-600 hover:text-red-800"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}

          <div className="border-t pt-6 flex justify-end">
            <div className="text-right">
              <p className="text-gray-600 text-sm mb-1">Total HT</p>
              <p className="text-3xl font-bold">{totalHT.toFixed(2)} €</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" className="btn-primary flex-1" disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-ghost flex-1 text-center"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
