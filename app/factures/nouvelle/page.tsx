'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Client { id: string; nom: string; adresse: string; }
interface Prestation { description: string; quantite: number; prixUnit: number; }

const toInt = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const toFloat = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export default function NouvelleFacturePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({
    typeDocument: 'Facture',
    date: new Date().toISOString().split('T')[0], // format yyyy-mm-dd OK pour <input type="date">
    clientId: '',
  });
  const [prestations, setPrestations] = useState<Prestation[]>([
    { description: '', quantite: 1, prixUnit: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/clients');
        const data = await r.json();
        setClients(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const handleChange = <K extends keyof Prestation>(i: number, field: K, value: Prestation[K]) => {
    setPrestations(prev => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  const addLine = () => setPrestations(p => [...p, { description: '', quantite: 1, prixUnit: 0 }]);
  const removeLine = (i: number) => prestations.length > 1 && setPrestations(p => p.filter((_, x) => x !== i));

  const totalHT =
    prestations.reduce((t, p) => t + (Number.isFinite(p.quantite) ? p.quantite : 0) * (Number.isFinite(p.prixUnit) ? p.prixUnit : 0), 0) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.clientId) {
      setErrorMsg('Veuillez sélectionner un client.');
      return;
    }

    // Sécurité anti-NaN : clamp propre avant envoi
    const safePrestations = prestations.map(p => ({
      description: p.description.trim(),
      quantite: Number.isFinite(p.quantite) && p.quantite >= 0 ? p.quantite : 0,
      prixUnit: Number.isFinite(p.prixUnit) && p.prixUnit >= 0 ? p.prixUnit : 0,
    }));
    const safeTotal = safePrestations.reduce((t, p) => t + p.quantite * p.prixUnit, 0);

    setSubmitting(true);
    try {
      const res = await fetch('/api/factures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, prestations: safePrestations, totalHT: safeTotal }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        setErrorMsg(`Erreur serveur (${res.status}). ${body || ''}`.trim());
        return;
      }

      const facture = await res.json();
      alert(`✅ Facture ${facture.numero ?? ''} créée avec succès !`);
      router.push('/factures');
    } catch (err: any) {
      setErrorMsg(`Erreur réseau : ${err?.message ?? err}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-10 max-w-5xl mx-auto">
      <h1 className="text-4xl font-extrabold mb-8">➕ Nouvelle Facture</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bandeau erreurs */}
        {errorMsg && (
          <div className="glass border border-red-400/40 bg-red-50/60 text-red-700 dark:text-red-300 dark:bg-red-900/20 rounded-xl p-3">
            {errorMsg}
          </div>
        )}

        {/* Infos générales */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-4">Informations générales</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type *</label>
              <select
                value={form.typeDocument}
                onChange={(e) => setForm({ ...form, typeDocument: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Facture">Facture</option>
                <option value="Devis">Devis</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value || new Date().toISOString().split('T')[0] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Client *</label>
              <select
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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

        {/* Prestations */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Prestations</h2>
            <button type="button" onClick={addLine} className="btn-primary text-sm">
              ➕ Ajouter une ligne
            </button>
          </div>

          {prestations.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-4 items-end mb-3">
              <div className="col-span-12 md:col-span-6">
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={p.description}
                  onChange={(e) => handleChange(i, 'description', e.target.value)}
                  placeholder="Ex: PRESTATION DJ TBH ONE (18h-00h)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="col-span-6 md:col-span-2">
                <label className="block text-sm font-medium mb-1">Quantité</label>
                <input
                  type="number"
                  min="0"
                  value={String(p.quantite)}            
                  onChange={(e) => handleChange(i, 'quantite', toInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center"
                  inputMode="numeric"
                  required
                />
              </div>

              <div className="col-span-6 md:col-span-2">
                <label className="block text-sm font-medium mb-1">Prix unitaire (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={String(p.prixUnit)}            
                  onChange={(e) => handleChange(i, 'prixUnit', toFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-right"
                  inputMode="decimal"
                  required
                />
              </div>

              <div className="col-span-3 md:col-span-1 flex flex-col justify-end">
                <label className="text-sm font-medium text-gray-500 mb-1">Total</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-center font-semibold">
                  {(p.quantite * p.prixUnit).toFixed(2)} €
                </div>
              </div>

              <div className="col-span-1 flex justify-center items-end">
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={prestations.length === 1}
                  className="text-red-600 hover:text-red-800 text-xl transition-colors"
                  title="Supprimer la ligne"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}

          <div className="border-t border-gray-200 mt-6 pt-6 flex justify-end">
            <div className="text-right">
              <p className="text-gray-600 text-sm mb-1">Total HT</p>
              <p className="text-3xl font-bold text-gray-900">{totalHT.toFixed(2)} €</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" className="btn-primary flex-1" disabled={submitting}>
            {submitting ? 'Enregistrement…' : '💾 Enregistrer la facture'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-ghost flex-1 text-center">
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
