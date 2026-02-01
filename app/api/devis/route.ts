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

// Générer numéro de devis
async function genererNumeroDevis(userId: string): Promise<string> {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0');
  const prefixe = `D${annee}-${mois}`;

  const result = await pool.query(
    `SELECT numero FROM devis 
     WHERE user_id = $1 AND numero LIKE $2 
     ORDER BY numero DESC LIMIT 1`,
    [userId, `${prefixe}-%`]
  );

  let nouveauNumero = 1;
  if (result.rows.length > 0) {
    const dernierNumero = parseInt(result.rows[0].numero.split('-')[2]);
    nouveauNumero = dernierNumero + 1;
  }

  return `${prefixe}-${String(nouveauNumero).padStart(3, '0')}`;
}

// GET /api/devis
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    if (id) {
      // Détail d'un devis avec prestations
      const devisResult = await pool.query(
        `SELECT d.*, c.nom as client_nom, c.adresse as client_adresse, 
                c.email as client_email, c.telephone as client_telephone, c.siret as client_siret
         FROM devis d
         LEFT JOIN clients c ON c.id = d.client_id
         WHERE d.id = $1 AND d.user_id = $2`,
        [id, user.id]
      );

      if (devisResult.rows.length === 0) {
        return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
      }

      const devis = devisResult.rows[0];

      const lignesResult = await pool.query(
        'SELECT * FROM prestations_devis WHERE devis_id = $1 ORDER BY id',
        [id]
      );

      return NextResponse.json({
        ...devis,
        prestations: lignesResult.rows,
      });
    }

    // Liste des devis
    const result = await pool.query(
      `SELECT d.*, c.nom as client_nom 
       FROM devis d
       LEFT JOIN clients c ON c.id = d.client_id
       WHERE d.user_id = $1
       ORDER BY d.date DESC, d.numero DESC`,
      [user.id]
    );

    return NextResponse.json(result.rows);
  } catch (e: any) {
    console.error('💥 GET /api/devis exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}

// POST /api/devis - Création
export async function POST(req: NextRequest) {
  const client = await pool.connect();
  
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const { client_id, date, prestations, status } = body;

    if (!client_id || !date || !prestations?.length) {
      await logAction('devis_created', 'devis_creation', 'failed', req, user.id);
      return NextResponse.json({ error: 'Données manquantes.' }, { status: 400 });
    }

    const numero = await genererNumeroDevis(user.id);

    const total_ht = prestations.reduce(
      (sum: number, p: any) => sum + p.quantite * p.prix_unit,
      0
    );

    await client.query('BEGIN');

    const devisResult = await client.query(
      `INSERT INTO devis (numero, client_id, date, total_ht, status, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [numero, client_id, date, total_ht, status || 'brouillon', user.id]
    );

    const devis = devisResult.rows[0];

    for (const presta of prestations) {
      await client.query(
        `INSERT INTO prestations_devis (description, quantite, prix_unit, devis_id) 
         VALUES ($1, $2, $3, $4)`,
        [presta.description, presta.quantite, presta.prix_unit, devis.id]
      );
    }

    await client.query('COMMIT');

    await logAction('devis_created', `devis_${devis.id}`, 'success', req, user.id);

    return NextResponse.json(devis, { status: 201 });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('💥 POST /api/devis exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  } finally {
    client.release();
  }
}

// PUT /api/devis?id=... - Modification
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const client = await pool.connect();

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const { client_id, date, prestations, status } = body;

    const total_ht = prestations.reduce(
      (sum: number, p: any) => sum + p.quantite * p.prix_unit,
      0
    );

    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE devis 
       SET client_id = $1, date = $2, total_ht = $3, status = $4, updated_at = NOW()
       WHERE id = $5 AND user_id = $6 
       RETURNING *`,
      [client_id, date, total_ht, status || 'brouillon', id, user.id]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
    }

    await client.query('DELETE FROM prestations_devis WHERE devis_id = $1', [id]);

    for (const presta of prestations) {
      await client.query(
        `INSERT INTO prestations_devis (description, quantite, prix_unit, devis_id) 
         VALUES ($1, $2, $3, $4)`,
        [presta.description, presta.quantite, presta.prix_unit, id]
      );
    }

    await client.query('COMMIT');

    await logAction('devis_updated', `devis_${id}`, 'success', req, user.id);

    return NextResponse.json(updateResult.rows[0]);
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('💥 PUT /api/devis exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE /api/devis?id=... - Suppression
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const client = await pool.connect();

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    await client.query('BEGIN');

    await client.query('DELETE FROM prestations_devis WHERE devis_id = $1', [id]);

    const result = await client.query(
      'DELETE FROM devis WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
    }

    await client.query('COMMIT');

    await logAction('devis_deleted', `devis_${id}`, 'success', req, user.id);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('💥 DELETE /api/devis exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  } finally {
    client.release();
  }
}
