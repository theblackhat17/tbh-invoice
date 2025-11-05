import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// GET /api/factures
//   - /api/factures              -> liste
//   - /api/factures?id=...       -> détail
//   - /api/factures?clientId=... -> filtrage par client
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const clientId = searchParams.get('clientId');

  try {
    // 🔹 Détail d'une facture
    if (id) {
      const { data, error } = await supabase
        .from('factures')
        .select(
          `
          id,
          numero,
          date,
          type_document,
          total_ht,
          client_id,
          clients ( id, nom, adresse ),
          facture_lignes ( id, description, quantite, prix_unit )
        `,
        )
        .eq('id', id)
        .single();

      if (error) {
        console.error('GET /api/factures?id error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json(
          { error: 'Facture introuvable.' },
          { status: 404 },
        );
      }

      const f: any = data;

      return NextResponse.json({
        id: f.id,
        numero: f.numero,
        date: f.date,
        typeDocument: f.type_document,
        totalHT: f.total_ht,
        clientId: f.client_id,
        client: f.clients,
        prestations: (f.facture_lignes ?? []).map((l: any) => ({
          id: l.id,
          description: l.description,
          quantite: l.quantite,
          prixUnit: l.prix_unit,
        })),
      });
    }

    // 🔹 Liste des factures (optionnellement filtrée par clientId)
    let query = supabase
      .from('factures')
      .select(
        `
        id,
        numero,
        date,
        type_document,
        total_ht,
        client_id,
        clients ( nom )
      `,
      )
      .order('date', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('GET /api/factures error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const factures =
      (data ?? []).map((f: any) => ({
        id: f.id,
        numero: f.numero,
        date: f.date,
        typeDocument: f.type_document,
        totalHT: f.total_ht,
        clientId: f.client_id,
        client: { nom: f.clients?.nom ?? '' },
      }));

    return NextResponse.json(factures);
  } catch (e: any) {
    console.error('GET /api/factures exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 },
    );
  }
}

/**
 * Génère un numéro de facture du style F-2025-0001, F-2025-0002, ...
 * en se basant sur le plus grand "numero" déjà présent.
 */
async function generateNumero() {
  const year = new Date().getFullYear();

  // On récupère le plus grand numero existant
  const { data, error } = await supabase
    .from('factures')
    .select('numero')
    .order('numero', { ascending: false })
    .limit(1);

  let nextNumber = 1;

  if (!error && data && data.length > 0 && data[0].numero) {
    const last = String(data[0].numero);
    const match = last.match(/(\d+)(?!.*\d)/); // derniers chiffres
    if (match) {
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n)) {
        nextNumber = n + 1;
      }
    }
  }

  return `F-${year}-${String(nextNumber).padStart(4, '0')}`;
}

// POST /api/factures
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { typeDocument, date, clientId, prestations, totalHT } = body;

    if (!clientId || !date || !typeDocument) {
      return NextResponse.json(
        { error: 'typeDocument, date et clientId sont obligatoires.' },
        { status: 400 },
      );
    }

    // ✅ on génère un numero pour respecter le NOT NULL
    const numero = await generateNumero();

    // Insertion de la facture
    const { data: inserted, error } = await supabase
      .from('factures')
      .insert({
        numero,                           // ✅ maintenant on remplit cette colonne
        type_document: typeDocument,
        date,
        client_id: clientId,
        total_ht: totalHT ?? 0,
      })
      .select('id, numero')
      .single();

    if (error) {
      console.error('POST /api/factures error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const factureId = (inserted as any).id;

    // Insertion des lignes
    if (Array.isArray(prestations) && prestations.length > 0) {
      const lignes = prestations.map((p: any) => ({
        facture_id: factureId,
        description: p.description ?? '',
        quantite: p.quantite ?? 0,
        prix_unit: p.prixUnit ?? 0,
      }));
      const { error: errLines } = await supabase
        .from('facture_lignes')
        .insert(lignes);
      if (errLines) {
        console.error('POST /api/factures lignes error:', errLines);
      }
    }

    return NextResponse.json(inserted, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/factures exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 },
    );
  }
}

// PUT /api/factures?id=...
export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { typeDocument, date, clientId, prestations, totalHT } = body;

    // Mise à jour de la facture
    const { error: errUpdate } = await supabase
      .from('factures')
      .update({
        type_document: typeDocument,
        date,
        client_id: clientId,
        total_ht: totalHT ?? 0,
      })
      .eq('id', id);

    if (errUpdate) {
      console.error('PUT /api/factures update error:', errUpdate);
      return NextResponse.json({ error: errUpdate.message }, { status: 500 });
    }

    // Remplacement des lignes : on supprime puis on recrée
    const { error: errDel } = await supabase
      .from('facture_lignes')
      .delete()
      .eq('facture_id', id);

    if (errDel) {
      console.error('PUT /api/factures delete lignes error:', errDel);
    }

    if (Array.isArray(prestations) && prestations.length > 0) {
      const lignes = prestations.map((p: any) => ({
        facture_id: id,
        description: p.description ?? '',
        quantite: p.quantite ?? 0,
        prix_unit: p.prixUnit ?? 0,
      }));
      const { error: errIns } = await supabase
        .from('facture_lignes')
        .insert(lignes);
      if (errIns) {
        console.error('PUT /api/factures insert lignes error:', errIns);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('PUT /api/factures exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 },
    );
  }
}

// DELETE /api/factures?id=...
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    // On supprime d’abord les lignes, puis la facture
    await supabase.from('facture_lignes').delete().eq('facture_id', id);
    const { error } = await supabase.from('factures').delete().eq('id', id);

    if (error) {
      console.error('DELETE /api/factures error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/factures exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 },
    );
  }
}
