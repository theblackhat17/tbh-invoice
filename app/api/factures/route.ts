import { NextResponse } from 'next/server';
import { getAllFactures, createFacture, deleteFacture, getClientById } from '@/lib/db';

// GET : Récupérer toutes les factures
export async function GET() {
  try {
    const factures = getAllFactures();
    
    // Ajouter les infos client à chaque facture
    const facturesAvecClient = factures.map(facture => ({
      ...facture,
      client: getClientById(facture.clientId)
    }));
    
    return NextResponse.json(facturesAvecClient);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des factures' }, { status: 500 });
  }
}

// POST : Créer une nouvelle facture
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, date, typeDocument, prestations, totalHT } = body;

    const facture = createFacture({
      date,
      typeDocument,
      clientId,
      totalHT,
      prestations,
    });

    // Retourner avec le client
    const factureAvecClient = {
      ...facture,
      client: getClientById(facture.clientId)
    };

    return NextResponse.json(factureAvecClient, { status: 201 });
  } catch (error) {
    console.error('Erreur:', error);
    return NextResponse.json({ error: 'Erreur lors de la création de la facture' }, { status: 500 });
  }
}

// DELETE : Supprimer une facture
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
    }

    const success = deleteFacture(id);
    
    if (!success) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Facture supprimée avec succès' });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la suppression de la facture' }, { status: 500 });
  }
}
