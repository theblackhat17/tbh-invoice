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

async function genererNumeroFacture(userId: string): Promise<string> {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0');
  const prefixe = `${annee}-${mois}`;

  const result = await pool.query(
    `SELECT numero FROM factures WHERE user_id = $1 AND numero LIKE $2 ORDER BY numero DESC LIMIT 1`,
    [userId, `${prefixe}-%`]
  );

  let nouveauNumero = 1;
  if (result.rows.length > 0) {
    const dernierNumero = parseInt(result.rows[0].numero.split('-')[2]);
    nouveauNumero = dernierNumero + 1;
  }

  return `${prefixe}-${String(nouveauNumero).padStart(3, '0')}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    if (id) {
      const factureResult = await pool.query(
        `SELECT f.*, c.nom as client_nom, c.adresse as client_adresse, c.email as client_email, c.telephone as client_telephone, c.siret as client_siret
         FROM factures f LEFT JOIN clients c ON c.id = f.client_id WHERE f.id = $1 AND f.user_id = $2`,
        [id, user.id]
      );

      if (factureResult.rows.length === 0) {
        return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 });
      }

      const facture = factureResult.rows[0];
      const lignesResult = await pool.query('SELECT * FROM prestations WHERE facture_id = $1 ORDER BY id', [id]);

      // Normaliser en camelCase
      return NextResponse.json({
        id: facture.id,
        numero: facture.numero,
        date: facture.date,
        typeDocument: facture.type_document,
        clientId: facture.client_id,
        totalHT: parseFloat(facture.total_ht),
        clientNom: facture.client_nom,
        clientAdresse: facture.client_adresse,
        clientEmail: facture.client_email,
        clientTelephone: facture.client_telephone,
        clientSiret: facture.client_siret,
        prestations: lignesResult.rows.map(p => ({
          id: p.id,
          description: p.description,
          quantite: p.quantite,
          prixUnit: parseFloat(p.prix_unit),
        })),
      });
    }

    // Liste des factures
    const result = await pool.query(
      `SELECT f.*, c.nom as client_nom FROM factures f LEFT JOIN clients c ON c.id = f.client_id WHERE f.user_id = $1 ORDER BY f.date DESC, f.numero DESC`,
      [user.id]
    );

    // Normaliser en camelCase
    const factures = result.rows.map(f => ({
      id: f.id,
      numero: f.numero,
      date: f.date,
      typeDocument: f.type_document,
      clientId: f.client_id,
      totalHT: parseFloat(f.total_ht),
      clientNom: f.client_nom,
      createdAt: f.created_at,
    }));

    return NextResponse.json(factures);
  } catch (e: any) {
    console.error('💥 GET /api/factures exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    console.log('📦 Body reçu:', body);

    const typeDocument = body.type_document || body.typeDocument;
    const clientId = body.client_id || body.clientId;
    const date = body.date;
    const prestations = body.prestations;

    console.log('🔍 Parsed:', { typeDocument, clientId, date, prestations });

    if (!typeDocument || !clientId || !date || !prestations?.length) {
      await logAction('facture_created', 'facture_creation', 'failed', req, user.id);
      return NextResponse.json({ error: 'Données manquantes.' }, { status: 400 });
    }

    const numero = await genererNumeroFacture(user.id);

    const total_ht = prestations.reduce((sum: number, p: any) => {
      const qty = p.quantite || 0;
      const price = p.prixUnit || p.prix_unit || 0;
      return sum + (qty * price);
    }, 0);

    await client.query('BEGIN');

    const factureResult = await client.query(
      `INSERT INTO factures (numero, type_document, client_id, date, total_ht, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [numero, typeDocument, clientId, date, total_ht, user.id]
    );

    const facture = factureResult.rows[0];

    for (const presta of prestations) {
      const description = presta.description;
      const quantite = presta.quantite || 0;
      const prix_unit = presta.prixUnit || presta.prix_unit || 0;

      await client.query(
        `INSERT INTO prestations (description, quantite, prix_unit, facture_id) VALUES ($1, $2, $3, $4)`,
        [description, quantite, prix_unit, facture.id]
      );
    }

    await client.query('COMMIT');
    await logAction('facture_created', `facture_${facture.id}`, 'success', req, user.id);

    return NextResponse.json(facture, { status: 201 });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('💥 POST /api/factures exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  } finally {
    client.release();
  }
}

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
    
    const typeDocument = body.type_document || body.typeDocument;
    const clientId = body.client_id || body.clientId;
    const date = body.date;
    const prestations = body.prestations;

    const total_ht = prestations.reduce((sum: number, p: any) => {
      const qty = p.quantite || 0;
      const price = p.prixUnit || p.prix_unit || 0;
      return sum + (qty * price);
    }, 0);

    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE factures SET type_document = $1, client_id = $2, date = $3, total_ht = $4 WHERE id = $5 AND user_id = $6 RETURNING *`,
      [typeDocument, clientId, date, total_ht, id, user.id]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 });
    }

    await client.query('DELETE FROM prestations WHERE facture_id = $1', [id]);

    for (const presta of prestations) {
      const description = presta.description;
      const quantite = presta.quantite || 0;
      const prix_unit = presta.prixUnit || presta.prix_unit || 0;

      await client.query(
        `INSERT INTO prestations (description, quantite, prix_unit, facture_id) VALUES ($1, $2, $3, $4)`,
        [description, quantite, prix_unit, id]
      );
    }

    await client.query('COMMIT');
    await logAction('facture_updated', `facture_${id}`, 'success', req, user.id);

    return NextResponse.json(updateResult.rows[0]);
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('💥 PUT /api/factures exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  } finally {
    client.release();
  }
}

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
    await client.query('DELETE FROM prestations WHERE facture_id = $1', [id]);

    const result = await client.query('DELETE FROM factures WHERE id = $1 AND user_id = $2 RETURNING id', [id, user.id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 });
    }

    await client.query('COMMIT');
    await logAction('facture_deleted', `facture_${id}`, 'success', req, user.id);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('💥 DELETE /api/factures exception:', e);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  } finally {
    client.release();
  }
}
