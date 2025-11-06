import { createClient } from '@/lib/supabase-browser';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function getClientIp(request: Request): string {
  const xfwd = request.headers.get('x-forwarded-for');
  if (xfwd) return xfwd.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    
    // Récupérer l'utilisateur avant de se déconnecter
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    // Déconnexion
    await supabase.auth.signOut();

    // Logger la déconnexion
    const ip_address = getClientIp(request);
    const user_agent = request.headers.get('user-agent') ?? 'unknown';

    const { error } = await supabaseAdmin.from('access_logs').insert({
      user_id: userId,
      action: 'logout',
      resource: 'auth',
      status: 'success',
      ip_address,
      user_agent,
    });

    if (error) {
      console.error('Erreur logging logout:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la déconnexion' },
      { status: 500 }
    );
  }
}