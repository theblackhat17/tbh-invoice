import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@/lib/supabase-browser';

export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, resource } = body;

    // Récupérer les infos de la requête
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Insérer le log (avec service role key pour bypasser RLS)
    const { error } = await supabaseAdmin
      .from('access_logs')
      .insert({
        user_id: user.id,
        action,
        resource,
        ip_address: ip,
        user_agent: userAgent,
      });

    if (error) {
      console.error('Log insertion error:', error);
      return NextResponse.json(
        { error: 'Erreur lors du logging' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log API error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}