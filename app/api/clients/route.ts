import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient as createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

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
    console.error('❌ Erreur logging:', err);
  }
}

// GET /api/clients
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const supabaseServer = await createSupabaseServerClient();

  try {
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }
    
    if (id) {
      // Détail d'un client
      const { data, error } = await supabaseServer
        .from('clients')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id) // Enforce RLS
        .single();

      if (error) {
        console.error('❌ GET /api/clients?id error:', error);
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
    const { data: clients, error } = await supabaseServer
      .from('clients')
      .select('*, factures(count)') // Use join for count
      .eq('user_id', user.id) // Enforce RLS
      .order('nom');

    if (error) {
      console.error('❌ GET /api/clients error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const clientsWithCount = (clients || []).map((c: any) => ({
      ...c,
      nbFactures: c.factures ? c.factures.length : 0, // Count from join
    }));

    return NextResponse.json(clientsWithCount);
  } catch (e: any) {
    console.error('💥 GET /api/clients exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 }
    );
  }
}

// POST /api/clients - Création
export async function POST(req: Request) {
  const supabaseServer = await createSupabaseServerClient();

  try {
    console.log('🔵 POST /api/clients - Début');
    
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }
    console.log('👤 User ID:', user.id);
    
    const body = await req.json();
    console.log('📦 Body:', body);
    
    const { nom, adresse, email, telephone, siret } = body;

    if (!nom || !adresse) {
      await logAction('user_created', 'client_creation', 'failed', req, user.id);
      return NextResponse.json(
        { error: 'nom et adresse sont obligatoires.' },
        { status: 400 }
      );
    }

    console.log('💾 Insertion dans Supabase...');
    const { data, error } = await supabaseServer
      .from('clients')
      .insert({
        nom,
        adresse,
        email: email || null,
        telephone: telephone || null,
        siret: siret || null,
        user_id: user.id, // Associate client with user
      })
      .select()
      .single();

    if (error) {
      console.error('❌ POST /api/clients error:', error);
      await logAction('user_created', 'client_creation', 'failed', req, user.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Client créé:', data);
    
    // Logger la création réussie
    await logAction('user_created', `client_${data.id}`, 'success', req, user.id);

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error('💥 POST /api/clients exception:', e);
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
  const supabaseServer = await createSupabaseServerClient();

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const { nom, adresse, email, telephone, siret } = body;

    if (!nom || !adresse) {
      await logAction('user_updated', `client_${id}`, 'failed', req, user.id);
      return NextResponse.json(
        { error: 'nom et adresse sont obligatoires.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from('clients')
      .update({
        nom,
        adresse,
        email: email || null,
        telephone: telephone || null,
        siret: siret || null,
        user_id: user.id, // Ensure user_id is updated or remains the same
      })
      .eq('id', id)
      .eq('user_id', user.id) // Enforce RLS
      .select()
      .single();

    if (error) {
      console.error('❌ PUT /api/clients error:', error);
      await logAction('user_updated', `client_${id}`, 'failed', req, user.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAction('user_updated', `client_${id}`, 'success', req, user.id);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error('💥 PUT /api/clients exception:', e);
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
  const supabaseServer = await createSupabaseServerClient();

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    // Vérifier si le client a des factures
    const { count } = await supabaseServer
      .from('factures')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', id)
      .eq('user_id', user.id); // Enforce RLS

    if (count && count > 0) {
      await logAction('user_deleted', `client_${id}`, 'failed', req, user.id);
      return NextResponse.json(
        { error: `Impossible de supprimer ce client. Il possède ${count} facture(s).` },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Enforce RLS

    if (error) {
      console.error('❌ DELETE /api/clients error:', error);
      await logAction('user_deleted', `client_${id}`, 'failed', req, user.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAction('user_deleted', `client_${id}`, 'success', req, user.id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('💥 DELETE /api/clients exception:', e);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 }
    );
  }
}
