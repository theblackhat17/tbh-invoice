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

async function getUserId(): Promise<string | null> {
  try {
    const supabaseBrowser = createClient();
    const { data: { user } } = await supabaseBrowser.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

// GET /api/clients
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      // Détail d'un client
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('GET /api/clients?id error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json(
          { error: 'Client introuvable.' },
          { status: 404 }
        );
      }

      return NextResponse.json(data);
    }

    // Liste des clients avec comptage des factures
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .order('nom');

    if (error) {
      console.error('GET /api/clients error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Compter les factures par client
    const clientsWithCount = await Promise.all(
      (clients || []).map(async (c: any) => {
        const { count } = await supabase
          .from('factures')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', c.id);

        return { ...c, nbFactures: count ?? 0 };
      })
    );

    return NextResponse.json(clientsWithCount);
  } catch (e: any) {
    console.error('GET /api/clients exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 }
    );
  }
}

// POST /api/clients - Création
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { nom, adresse, email, telephone, siret } = body;

    if (!nom || !adresse) {
      await logAction('user_created', 'client_creation', 'failed', req, userId);
      return NextResponse.json(
        { error: 'nom et adresse sont obligatoires.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        nom,
        adresse,
        email: email || null,
        telephone: telephone || null,
        siret: siret || null,
      })
      .select()
      .single();

    if (error) {
      console.error('POST /api/clients error:', error);
      await logAction('user_created', 'client_creation', 'failed', req, userId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Logger la création réussie
    await logAction('user_created', `client_${data.id}`, 'success', req, userId);

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/clients exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 }
    );
  }
}

// PUT /api/clients?id=... - Modification
export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const userId = await getUserId();
    const body = await req.json();
    const { nom, adresse, email, telephone, siret } = body;

    if (!nom || !adresse) {
      await logAction('user_updated', `client_${id}`, 'failed', req, userId);
      return NextResponse.json(
        { error: 'nom et adresse sont obligatoires.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('clients')
      .update({
        nom,
        adresse,
        email: email || null,
        telephone: telephone || null,
        siret: siret || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('PUT /api/clients error:', error);
      await logAction('user_updated', `client_${id}`, 'failed', req, userId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Logger la modification réussie
    await logAction('user_updated', `client_${id}`, 'success', req, userId);

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('PUT /api/clients exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 }
    );
  }
}

// DELETE /api/clients?id=... - Suppression
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const userId = await getUserId();

    // Vérifier si le client a des factures
    const { count } = await supabase
      .from('factures')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', id);

    if (count && count > 0) {
      await logAction('user_deleted', `client_${id}`, 'failed', req, userId);
      return NextResponse.json(
        { error: `Impossible de supprimer ce client. Il possède ${count} facture(s).` },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('clients').delete().eq('id', id);

    if (error) {
      console.error('DELETE /api/clients error:', error);
      await logAction('user_deleted', `client_${id}`, 'failed', req, userId);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Logger la suppression réussie
    await logAction('user_deleted', `client_${id}`, 'success', req, userId);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/clients exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 }
    );
  }
}