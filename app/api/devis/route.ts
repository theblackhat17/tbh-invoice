import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-browser';

// Helper to get client IP
function getClientIp(request: Request): string {
  const xfwd = request.headers.get('x-forwarded-for');
  if (xfwd) return xfwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

// Helper to log actions
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
    console.error('Logging error:', err);
  }
}

// GET /api/devis
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const clientId = searchParams.get('clientId');

  try {
    const supabaseBrowser = createClient();
    const { data: { user } } = await supabaseBrowser.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    // Get a single quote details
    if (id) {
      const { data: devis, error } = await supabase
        .from('devis')
        .select(`
          id,
          numero,
          date,
          total_ht,
          client_id,
          status,
          clients ( id, nom, adresse )
        `)
        .eq('id', id)
        .eq('user_id', user.id) // Sécurité : ne récupérer que si l'utilisateur est propriétaire
        .single();

      if (error) {
        console.error('GET /api/devis?id error:', error);
        await logAction('quote_viewed', `quote_${id}`, 'failed', req, user.id);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
      }

      if (!devis) {
        await logAction('quote_viewed', `quote_${id}`, 'failed', req, user.id);
        return NextResponse.json({ error: 'Devis introuvable ou accès non autorisé.' }, { status: 404 });
      }

      await logAction('quote_viewed', `quote_${id}`, 'success', req, user.id);

      const { data: lignes, error: err2 } = await supabase
        .from('prestations_devis')
        .select('id, description, quantite, prix_unit')
        .eq('devis_id', id)
        .order('id');

      if (err2) {
        console.error('GET /api/devis prestations error:', err2);
      }

      const d: any = devis;

      return NextResponse.json({
        id: d.id,
        numero: d.numero,
        date: d.date,
        totalHT: d.total_ht,
        clientId: d.client_id,
        status: d.status,
        client: d.clients,
        prestations: (lignes ?? []).map((l: any) => ({
          id: l.id,
          description: l.description,
          quantite: l.quantite,
          prixUnit: l.prix_unit,
        })),
      });
    }

    // Get list of quotes
    let query = supabase
      .from('devis')
      .select(`
        id,
        numero,
        date,
        total_ht,
        status,
        client_id,
        clients ( nom )
      `)
      .eq('user_id', user.id) // Sécurité : ne lister que les devis de l'utilisateur
      .order('date', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('GET /api/devis error:', error);
      return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }

    const devisList = (data ?? []).map((d: any) => ({
      id: d.id,
      numero: d.numero,
      date: d.date,
      totalHT: d.total_ht,
      status: d.status,
      clientId: d.client_id,
      client: { nom: d.clients?.nom ?? '' },
    }));

    return NextResponse.json(devisList);
  } catch (e: any) {
    console.error('GET /api/devis exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}

// Generate a new quote number
async function generateNumero() {
  const year = new Date().getFullYear();

  const { data, error } = await supabase
    .from('devis')
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

  return `D-${year}-${String(nextNumber).padStart(4, '0')}`;
}

// POST /api/devis - Create a new quote
export async function POST(req: Request) {
  try {
    const supabaseBrowser = createClient();
    const { data: { user } } = await supabaseBrowser.auth.getUser();

    const body = await req.json();
    const { date, clientId, prestations, totalHT, status } = body;

    if (!clientId || !date) {
      await logAction('quote_generated', 'quote_creation', 'failed', req, user?.id);
      return NextResponse.json({ error: 'Date et clientId sont obligatoires.' }, { status: 400 });
    }

    const numero = await generateNumero();

    const { data: inserted, error } = await supabase
      .from('devis')
      .insert({
        numero,
        date,
        client_id: clientId,
        total_ht: totalHT ?? 0,
        status: status || 'Brouillon',
        user_id: user?.id
      })
      .select('id, numero')
      .single();

    if (error) {
      console.error('POST /api/devis error:', error);
      await logAction('quote_generated', 'quote_creation', 'failed', req, user?.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const devisId = (inserted as any).id;

    if (Array.isArray(prestations) && prestations.length > 0) {
      const lignes = prestations.map((p: any) => ({
        devis_id: devisId,
        description: p.description ?? '',
        quantite: p.quantite ?? 0,
        prix_unit: p.prixUnit ?? 0,
      }));
      const { error: errLines } = await supabase
        .from('prestations_devis')
        .insert(lignes);
      if (errLines) {
        console.error('POST /api/devis prestations error:', errLines);
      }
    }

    await logAction('quote_generated', `quote_${devisId}`, 'success', req, user?.id);

    return NextResponse.json(inserted, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/devis exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}

// PUT /api/devis?id=... - Update a quote
export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const supabaseBrowser = createClient();
    const { data: { user } } = await supabaseBrowser.auth.getUser();

    const body = await req.json();
    const { date, clientId, prestations, totalHT, status } = body;

    const { error: errUpdate } = await supabase
      .from('devis')
      .update({
        date,
        client_id: clientId,
        total_ht: totalHT ?? 0,
        status: status
      })
      .eq('id', id);

    if (errUpdate) {
      console.error('PUT /api/devis update error:', errUpdate);
      await logAction('quote_updated', `quote_${id}`, 'failed', req, user?.id);
      return NextResponse.json({ error: errUpdate.message }, { status: 500 });
    }

    // For full updates, clear old lines and insert new ones
    if (Array.isArray(prestations)) {
        await supabase.from('prestations_devis').delete().eq('devis_id', id);

        if (prestations.length > 0) {
            const lignes = prestations.map((p: any) => ({
                devis_id: id,
                description: p.description ?? '',
                quantite: p.quantite ?? 0,
                prix_unit: p.prixUnit ?? 0,
            }));
            await supabase.from('prestations_devis').insert(lignes);
        }
    }

    await logAction('quote_updated', `quote_${id}`, 'success', req, user?.id);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('PUT /api/devis exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}

// DELETE /api/devis?id=... - Delete a quote
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const supabaseBrowser = createClient();
    const { data: { user } } = await supabaseBrowser.auth.getUser();

    // Associated lines are deleted by CASCADE constraint
    const { error } = await supabase.from('devis').delete().eq('id', id);

    if (error) {
      console.error('DELETE /api/devis error:', error);
      await logAction('quote_deleted', `quote_${id}`, 'failed', req, user?.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAction('quote_deleted', `quote_${id}`, 'success', req, user?.id);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/devis exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}