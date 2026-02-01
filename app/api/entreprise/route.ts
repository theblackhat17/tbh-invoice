import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/middleware-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const result = await pool.query('SELECT * FROM entreprise WHERE user_id = $1', [user.id]);
    
    if (result.rows.length === 0) {
      return NextResponse.json(null);
    }

    return NextResponse.json(result.rows[0]);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const { nom, adresse, code_postal, ville, telephone, email, siret, tva_intra } = body;

    const result = await pool.query(
      `INSERT INTO entreprise (user_id, nom, adresse, code_postal, ville, telephone, email, siret, tva_intra)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) DO UPDATE SET
         nom = $2, adresse = $3, code_postal = $4, ville = $5, 
         telephone = $6, email = $7, siret = $8, tva_intra = $9, updated_at = NOW()
       RETURNING *`,
      [user.id, nom, adresse, code_postal, ville, telephone, email, siret, tva_intra]
    );

    return NextResponse.json(result.rows[0]);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
