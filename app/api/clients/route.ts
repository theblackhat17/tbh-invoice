import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/middleware-auth';

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

    await pool.query(
      'INSERT INTO access_logs (user_id, action, resource, status, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId || null, action, resource, status, ip_address, user_agent]
    );
  } catch (err) {
    console.error('❌ Erreur logging:', err);
  }
}

// GET /api/clients
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }
    
    if (id) {
      // Détail d'un client
      const result = await pool.query(
        'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
        [id, user.id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 });
      }

      return NextResponse.json(result.rows[0]);
    }

    // Liste des clients avec comptage des factures
    const result = await pool.query(`
      SELECT 
        c.*,
        COUNT(f.id)::int as nb_factures
      FROM clients c
      LEFT JOIN factures f ON f.client_id = c.id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY c.nom
    `, [user.id]);

    const clientsWithCount = result.rows.map(c => ({
      ...c,
      nbFactures: c.nb_factures,
    }));

    return NextResponse.json(clientsWithCount);
  } catch (e: any) {
    console.error('💥 GET /api/clients exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}

// POST /api/clients - Création
export async function POST(req: NextRequest) {
  try {
    console.log('🔵 POST /api/clients - Début');
    
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }
    console.log('👤 User ID:', user.id);
    
    const body = await req.json();
    console.log('📦 Body:', body);
    
    const { nom, adresse, email, telephone, siret } = body;

    if (!nom || !adresse) {
      await logAction('user_created', 'client_creation', 'failed', req, user.id);
      return NextResponse.json({ error: 'nom et adresse sont obligatoires.' }, { status: 400 });
    }

    console.log('💾 Insertion dans PostgreSQL...');
    const result = await pool.query(
      `INSERT INTO clients (nom, adresse, email, telephone, siret, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [nom, adresse, email || null, telephone || null, siret || null, user.id]
    );

    const data = result.rows[0];
    console.log('✅ Client créé:', data);
    
    await logAction('user_created', `client_${data.id}`, 'success', req, user.id);

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error('💥 POST /api/clients exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}

// PUT /api/clients?id=... - Modification
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const { nom, adresse, email, telephone, siret } = body;

    if (!nom || !adresse) {
      await logAction('user_updated', `client_${id}`, 'failed', req, user.id);
      return NextResponse.json({ error: 'nom et adresse sont obligatoires.' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE clients 
       SET nom = $1, adresse = $2, email = $3, telephone = $4, siret = $5 
       WHERE id = $6 AND user_id = $7 
       RETURNING *`,
      [nom, adresse, email || null, telephone || null, siret || null, id, user.id]
    );

    if (result.rows.length === 0) {
      await logAction('user_updated', `client_${id}`, 'failed', req, user.id);
      return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 });
    }

    await logAction('user_updated', `client_${id}`, 'success', req, user.id);
    return NextResponse.json(result.rows[0]);
  } catch (e: any) {
    console.error('💥 PUT /api/clients exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}

// DELETE /api/clients?id=... - Suppression
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    // Vérifier si le client a des factures
    const countResult = await pool.query(
      'SELECT COUNT(*)::int as count FROM factures WHERE client_id = $1 AND user_id = $2',
      [id, user.id]
    );

    const count = countResult.rows[0].count;
    if (count > 0) {
      await logAction('user_deleted', `client_${id}`, 'failed', req, user.id);
      return NextResponse.json(
        { error: `Impossible de supprimer ce client. Il possède ${count} facture(s).` },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.id]
    );

    if (result.rows.length === 0) {
      await logAction('user_deleted', `client_${id}`, 'failed', req, user.id);
      return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 });
    }

    await logAction('user_deleted', `client_${id}`, 'success', req, user.id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('💥 DELETE /api/clients exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}
