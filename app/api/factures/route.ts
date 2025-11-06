import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-browser';

function getClientIp(request: Request): string {
  const xfwd = request.headers.get('x-forwarded-for');
  if (xfwd) return xfwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

async function logAction(
  action: string,
  resource: string,
  status: 'success' | 'failed',
  request: Request,
  userId?: string | null
) {
  try {
    const ip_address = getClientIp(request);
    const user_agent = request.headers.get('user-agent') ?? 'unknown';

    await supabaseAdmin.from('access_logs').insert({
      user_id: userId || null,
      action,
      resource,
      status,
      ip_address,
      user_agent,
    });
  } catch (err) {
    console.error('Erreur logging:', err);
  }
}

// GET /api/factures
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const clientId = searchParams.get('clientId');

  try {
    // Récupérer userId pour le log
    const supabaseBrowser = createClient();
    const { data: { user } } = await supabaseBrowser.auth.getUser();

    // Détail d'une facture
    if (id) {
      const { data: facture, error } = await supabase
        .from('factures')
        .select(
          `
          id,
          numero,
          date,
          type_document,
          total_ht,
          client_id,
          clients ( id, nom, adresse )
        `,
        )
        .eq('id', id)
        .single();

      if (error) {
        console.error('GET /api/factures?id error:', error);
        await logAction('invoice_viewed', `invoice_${id}`, 'failed', req, user?.id);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!facture) {
        await logAction('invoice_viewed', `invoice_${id}`, 'failed', req, user?.id);
        return NextResponse.json(
          { error: 'Facture introuvable.' },
          { status: 404 },
        );
      }

      // Logger la consultation
      await logAction('invoice_viewed', `invoice_${id}`, 'success', req, user?.id);

      const { data: lignes, error: err2 } = await supabase
        .from('prestations')
        .select('id, description, quantite, prix_unit')
        .eq('facture_id', id)
        .order('id');

      if (err2) {
        console.error('GET /api/factures prestations error:', err2);
      }

      const f: any = facture;

      return NextResponse.json({
        id: f.id,
        numero: f.numero,
        date: f.date,
        typeDocument: f.type_document,
        totalHT: f.total_ht,
        clientId: f.client_id,
        client: f.clients,
        prestations: (lignes ?? []).map((l: any) => ({
          id: l.id,
          description: l.description,
          quantite: l.quantite,
          prixUnit: l.prix_unit,
        })),
      });
    }

    // Liste des factures
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

async function generateNumero() {
  const year = new Date().getFullYear();

  const { data, error } = await supabase
    .from('factures')
    .select('numero')
    .order('numero', { ascending: false })
    .limit(1);

  let nextNumber = 1;

  if (!error && data && data.length > 0 && data[0].numero) {
    const last = String(data[0].numero);
    const match = last.match(/(\d+)(?!.*\d)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n)) {
        nextNumber = n + 1;
      }
    }
  }

  return `F-${year}-${String(nextNumber).padStart(4, '0')}`;
}

// POST /api/factures - Création
export async function POST(req: Request) {
  try {
    // Récupérer userId
    const supabaseBrowser = createClient();
    const { data: { user } } = await supabaseBrowser.auth.getUser();

    const body = await req.json();
    const { typeDocument, date, clientId, prestations, totalHT } = body;

    if (!clientId || !date || !typeDocument) {
      await logAction('invoice_generated', 'invoice_creation', 'failed', req, user?.id);
      return NextResponse.json(
        { error: 'typeDocument, date et clientId sont obligatoires.' },
        { status: 400 },
      );
    }

    const numero = await generateNumero();

    const { data: inserted, error } = await supabase
      .from('factures')
      .insert({
        numero,
        type_document: typeDocument,
        date,
        client_id: clientId,
        total_ht: totalHT ?? 0,
      })
      .select('id, numero')
      .single();

    if (error) {
      console.error('POST /api/factures error:', error);
      await logAction('invoice_generated', 'invoice_creation', 'failed', req, user?.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const factureId = (inserted as any).id;

    if (Array.isArray(prestations) && prestations.length > 0) {
      const lignes = prestations.map((p: any) => ({
        facture_id: factureId,
        description: p.description ?? '',
        quantite: p.quantite ?? 0,
        prix_unit: p.prixUnit ?? 0,
      }));
      const { error: errLines } = await supabase
        .from('prestations')
        .insert(lignes);
      if (errLines) {
        console.error('POST /api/factures prestations error:', errLines);
      }
    }

    // Logger la création réussie
    await logAction('invoice_generated', `invoice_${factureId}`, 'success', req, user?.id);

    return NextResponse.json(inserted, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/factures exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 },
    );
  }
}

// PUT /api/factures?id=... - Modification
export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    // Récupérer userId
    const supabaseBrowser = createClient();
    const { data: { user } } = await supabaseBrowser.auth.getUser();

    const body = await req.json();
    const { typeDocument, date, clientId, prestations, totalHT } = body;

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
      await logAction('invoice_updated', `invoice_${id}`, 'failed', req, user?.id);
      return NextResponse.json({ error: errUpdate.message }, { status: 500 });
    }

    // Purger anciennes lignes
    await supabase.from('prestations').delete().eq('facture_id', id);

    if (Array.isArray(prestations) && prestations.length > 0) {
      const lignes = prestations.map((p: any) => ({
        facture_id: id,
        description: p.description ?? '',
        quantite: p.quantite ?? 0,
        prix_unit: p.prixUnit ?? 0,
      }));
      await supabase.from('prestations').insert(lignes);
    }

    // Logger la modification
    await logAction('invoice_updated', `invoice_${id}`, 'success', req, user?.id);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('PUT /api/factures exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 },
    );
  }
}

// DELETE /api/factures?id=... - Suppression
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    // Récupérer userId
    const supabaseBrowser = createClient();
    const { data: { user } } = await supabaseBrowser.auth.getUser();

    await supabase.from('prestations').delete().eq('facture_id', id);
    const { error } = await supabase.from('factures').delete().eq('id', id);

    if (error) {
      console.error('DELETE /api/factures error:', error);
      await logAction('invoice_deleted', `invoice_${id}`, 'failed', req, user?.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Logger la suppression
    await logAction('invoice_deleted', `invoice_${id}`, 'success', req, user?.id);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/factures exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 },
    );
  }
}