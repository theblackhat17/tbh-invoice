'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Client {
  id: string;
  nom: string;
  adresse: string;
  email?: string;
  telephone?: string;
  _count?: {
    factures: number;
  };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients');
      const data = await response.json();
      setClients(data);
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteClient = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return;

    try {
      await fetch(`/api/clients?id=${id}`, { method: 'DELETE' });
      fetchClients(); // Recharger la liste
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-12 text-center">Chargement...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Liste des Clients</h1>
        <Link href="/clients/nouveau" className="btn-secondary">
          ➕ Ajouter un client
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">Aucun client enregistré</p>
          <Link href="/clients/nouveau" className="btn-primary">
            Créer votre premier client
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div key={client.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">{client.nom}</h3>
                <button
                  onClick={() => deleteClient(client.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  🗑️
                </button>
              </div>
              
              <p className="text-gray-600 mb-2">📍 {client.adresse}</p>
              {client.email && <p className="text-gray-600 mb-2">✉️ {client.email}</p>}
              {client.telephone && <p className="text-gray-600 mb-2">📞 {client.telephone}</p>}
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  {client._count?.factures || 0} facture(s)
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
