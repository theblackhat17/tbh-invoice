import { NextResponse } from 'next/server';
import { getAllClients, createClient, deleteClient, getAllFactures } from '@/lib/db';

// GET : Récupérer tous les clients
export async function GET() {
  try {
    const clients = getAllClients();
    const factures = getAllFactures();
    
    // Ajouter le compte de factures pour chaque client
    const clientsAvecCompte = clients.map(client => ({
      ...client,
      _count: {
        factures: factures.filter(f => f.clientId === client.id).length
      }
    }));
    
    return NextResponse.json(clientsAvecCompte);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des clients' }, { status: 500 });
  }
}

// POST : Créer un nouveau client
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nom, adresse, email, telephone, siret } = body;

    const client = createClient({
      nom,
      adresse,
      email,
      telephone,
      siret,
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la création du client' }, { status: 500 });
  }
}

// DELETE : Supprimer un client
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
    }

    const success = deleteClient(id);
    
    if (!success) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Client supprimé avec succès' });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la suppression du client' }, { status: 500 });
  }
}
