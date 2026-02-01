import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/middleware-auth';
import { generateFacturePDF } from '@/lib/pdf-generator';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'facture';
    const id = searchParams.get('id');
    const action = searchParams.get('action') || 'download';

    if (!id) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
    }

    // Récupérer les données entreprise
    const entrepriseResult = await pool.query(
      'SELECT * FROM entreprise WHERE user_id = $1',
      [user.id]
    );

    const entreprise = entrepriseResult.rows[0] || {
      nom: 'Votre Entreprise',
      adresse: 'Adresse non définie',
      telephone: '',
      email: '',
      siret: '',
    };

    let factureData: any;

    if (type === 'facture') {
      const factureResult = await pool.query(
        `SELECT f.*, c.nom as client_nom, c.adresse as client_adresse, 
                c.email as client_email, c.telephone as client_telephone, c.siret as client_siret
         FROM factures f
         LEFT JOIN clients c ON c.id = f.client_id
         WHERE f.id = $1 AND f.user_id = $2`,
        [id, user.id]
      );

      if (factureResult.rows.length === 0) {
        return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
      }

      const facture = factureResult.rows[0];

      const prestationsResult = await pool.query(
        'SELECT * FROM prestations WHERE facture_id = $1 ORDER BY id',
        [id]
      );

      factureData = {
        numero: facture.numero,
        date: facture.date,
        typeDocument: facture.type_document,
        clientNom: facture.client_nom,
        clientAdresse: facture.client_adresse,
        clientEmail: facture.client_email,
        clientTelephone: facture.client_telephone,
        clientSiret: facture.client_siret,
        totalHT: parseFloat(facture.total_ht),
        prestations: prestationsResult.rows.map((p) => ({
          description: p.description,
          quantite: p.quantite,
          prixUnit: parseFloat(p.prix_unit),
        })),
      };
    } else {
      return NextResponse.json({ error: 'Type non supporté' }, { status: 400 });
    }

    // Générer le PDF
    const pdfBytes = await generateFacturePDF(factureData, entreprise);

    const filename = `${factureData.typeDocument}_${factureData.numero}.pdf`;

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    
    if (action === 'download') {
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      headers.set('Content-Disposition', `inline; filename="${filename}"`);
    }

   return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('❌ Erreur génération PDF:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
