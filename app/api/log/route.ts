// app/api/log/route.ts (GET amélioré avec pagination + vérif admin)
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-browser';

async function requireAdmin(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, json: { error: 'Non autorisé' } };

  // Vérifie champ is_admin dans ta table users (adapter si tu as un autre nom)
  const { data: rows } = await supabaseAdmin
    .from('users') // <-- adapte si ta table d'utilisateurs s'appelle différemment
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!rows?.is_admin) return { ok: false, status: 403, json: { error: 'Accès réservé aux admins' } };
  return { ok: true, user };
}

export async function GET(request: Request) {
  try {
    // Vérif admin
    const check = await requireAdmin(request);
    if (!check.ok) return NextResponse.json(check.json, { status: check.status });

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 1000); // cap max 1000
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const action = url.searchParams.get('action') ?? null;
    const ip = url.searchParams.get('ip') ?? null;

    let query = supabaseAdmin
      .from('access_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1); // range uses start,end

    if (action) query = query.eq('action', action);
    if (ip) query = query.eq('ip_address', ip);

    const { data, count, error } = await query;

    if (error) {
      console.error('Erreur récupération logs:', error);
      return NextResponse.json({ error: 'Erreur lors de la récupération des logs' }, { status: 500 });
    }

    return NextResponse.json({
      total: count ?? null,
      limit,
      offset,
      data: data ?? [],
    });
  } catch (err) {
    console.error('Erreur GET /api/log:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
