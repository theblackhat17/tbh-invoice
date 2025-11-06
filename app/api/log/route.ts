// app/api/log/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type LogPayload = {
  action: string;
  resource: string;
  status?: 'success' | 'failed';
  userId?: string | null;
};

function getClientIp(request: Request): string {
  const xfwd = request.headers.get('x-forwarded-for');
  if (xfwd) return xfwd.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

/* ----------- POST : créer un log ----------- */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LogPayload;

    const action = body.action?.trim();
    const resource = body.resource?.trim();
    const status = body.status ?? 'success';
    const userId = body.userId ?? null;

    if (!action || !resource) {
      return NextResponse.json(
        { error: 'action et resource obligatoires' },
        { status: 400 }
      );
    }

    const ip_address = getClientIp(request);
    const user_agent = request.headers.get('user-agent') ?? 'unknown';

    const { error } = await supabaseAdmin.from('access_logs').insert({
      user_id: userId,
      action,
      resource,
      status,
      ip_address,
      user_agent,
    });

    if (error) {
      console.error('Erreur log:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la création du log' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Log enregistré' });
  } catch (err) {
    console.error('Erreur POST /api/log:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/* ----------- GET : lister les logs avec pagination ----------- */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 1000);
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const ip = url.searchParams.get('ip') || undefined;
    const action = url.searchParams.get('action') || undefined;
    const status = url.searchParams.get('status') || undefined;

    let query = supabaseAdmin
      .from('access_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (ip) query = query.eq('ip_address', ip);
    if (action) query = query.eq('action', action);
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, count, error } = await query;

    if (error) {
      console.error('Erreur récupération logs:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des logs' },
        { status: 500 }
      );
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
