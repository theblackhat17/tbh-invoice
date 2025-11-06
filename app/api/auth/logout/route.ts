import { createClient } from '@/lib/supabase-browser';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la déconnexion' },
      { status: 500 }
    );
  }
}