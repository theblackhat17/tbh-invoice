// app/api/log/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type LogPayload = {
  action: string;                // ex: "login_attempt"
  resource: string;              // ex: "email=test@example.com"
  status?: 'success' | 'failed'; // "success" ou "failed"
  userId?: string | null;        // facultatif
};

function getClientIp(request: Request): string {
  const xfwd = request.headers.get('x-forwarded-for');
  if (xfwd) return xfwd.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LogPayload;

    const action = body.action?.trim();
    const resource = body.resource?.trim();
    const status = body.status ?? 'success';
    const userId = body.userId ?? null;

    if (!action || !resource) {
      return NextResponse.json({ error: 'action et resource obligatoires' }, { status: 400 });
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
      return NextResponse.json({ error: 'Erreur lors de la création du log' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Log enregistré' });
  } catch (err) {
    console.error('Erreur POST /api/log:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('access_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error('Erreur GET /api/log:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
