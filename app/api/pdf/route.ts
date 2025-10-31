// Force Node.js runtime (sinon Buffer/stream indisponible en Edge)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Bufferiser un PDFKit doc sans utiliser le namespace PDFKit
const pdfToBuffer = (doc: InstanceType<typeof PDFDocument>) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

// Assure l'existence du bucket public (ignorer si déjà créé)
async function ensureBucket() {
  const { data: list } = await supabaseAdmin.storage.listBuckets();
  if (!list?.find((b) => b.name === 'factures')) {
    await supabaseAdmin.storage
      .createBucket('factures', { public: true, fileSizeLimit: '20mb' })
      .catch(() => void 0);
  }
}

// Récupérer facture + client + prestations (via Supabase)
async function fetchFactureFull(id: string) {
  const { data: facture, error } = await supabaseAdmin
    .from('factures')
    .select(`
      id,
      numero,
      date,
      type_document,
      total_ht,
      client:clients ( id, nom, adresse )
    `)
    .eq('id', id)
    .single();

  if (error || !facture) throw new Error(error?.message || 'Facture introuvable');

  const { data: lignes, error: err2 } = await supabaseAdmin
    .from('prestations')
    .select('description, quantite, prix_unit')
    .eq('facture_id', id)
    .order('description');

  if (err2) throw new Error(err2.message);

  return {
    id: String(facture.id),
    numero: String(facture.numero),
    date: String(facture.date),
    typeDocument: String(facture.type_document),
    totalHT: Number(facture.total_ht ?? 0),
    client: {
      nom: (facture.client as any)?.nom || '—',
      adresse: (facture.client as any)?.adresse || '',
    },
    prestations: (lignes ?? []).map((p) => ({
      description: String(p.description ?? ''),
      quantite: Number(p.quantite ?? 0),
      prixUnit: Number(p.prix_unit ?? 0),
    })),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

    const facture = await fetchFactureFull(id);

    // Génération PDF
    const doc = new PDFDocument({ margin: 50 });

    // En-tête
    doc.fontSize(24).font('Helvetica-Bold').text('TBH ONE', 50, 50);
    doc.fontSize(10).font('Helvetica')
      .text('VANDEWALLE CLEMENT', 50, 80)
      .text('39 Avenue Émile Zola', 50, 95)
      .text('59800 Lille', 50, 110)
      .text('Siret : 91127899200019', 50, 125);
    doc.fontSize(20).font('Helvetica-Bold')
      .text(`${facture.typeDocument} N°${facture.numero}`, 350, 50, { align: 'right' });

    // Client + date
    doc.fontSize(12).font('Helvetica-Bold').text('Client :', 350, 120);
    doc.fontSize(10).font('Helvetica')
      .text(facture.client.nom, 350, 140)
      .text(`Adresse : ${facture.client.adresse}`, 350, 155);

    const dateFormatee = new Date(facture.date).toLocaleDateString('fr-FR');
    doc.fillColor('#e74c3c');
    doc.fontSize(10).font('Helvetica').text(`Date : ${dateFormatee}`, 350, 185, { align: 'right' });
    doc.fillColor('black');

    // Tableau
    const tableTop = 250, col1 = 50, col2 = 350, col3 = 450, col4 = 520;
    doc.fontSize(11).font('Helvetica-Bold');
    doc.rect(col1, tableTop, 500, 25).fillAndStroke('#f0f0f0', '#cccccc');
    doc.fillColor('#000').text('Prestation', col1 + 5, tableTop + 7)
      .text('Quantité', col2 + 5, tableTop + 7)
      .text('Prix unit.', col3 + 5, tableTop + 7)
      .text('Total', col4 + 5, tableTop + 7);

    let y = tableTop + 35;
    doc.font('Helvetica').fontSize(10);
    facture.prestations.forEach((p, i) => {
      const bg = i % 2 ? '#f9f9f9' : '#ffffff';
      doc.rect(col1, y - 5, 500, 25).fillAndStroke(bg, '#e0e0e0');
      doc.fillColor('#000')
        .text(p.description, col1 + 5, y, { width: 280 })
        .text(String(p.quantite), col2 + 5, y)
        .text(`${p.prixUnit.toFixed(2)} €`, col3 + 5, y)
        .text(`${(p.quantite * p.prixUnit).toFixed(2)} €`, col4 + 5, y);
      y += 30;
    });

    // Total
    y += 20;
    doc.fontSize(14).font('Helvetica-Bold');
    doc.rect(col3 - 10, y, 162, 30).fillAndStroke('#3b82f6', '#3b82f6');
    doc.fillColor('#fff').text('Total HT :', col3, y + 8)
      .text(`${facture.totalHT.toFixed(2)} €`, col4, y + 8, { align: 'right' });

    // Pied de page
    doc.fontSize(9).fillColor('#666').font('Helvetica');
    doc.text('IBAN : FR76 2823 3000 0153 3547 5796 770 | REVOLUT', 50, 700);
    doc.text('Nom/Prénom : VANDEWALLE CLEMENT', 50, 715);
    doc.text('TVA non applicable, article 293B du CGI', 50, 745, { align: 'center' });

    doc.end();
    const buffer = await pdfToBuffer(doc);

    // Upload Storage
    await ensureBucket();
    const yyyy = new Date(facture.date).getFullYear();
    const mm = String(new Date(facture.date).getMonth() + 1).padStart(2, '0');
    const path = `${yyyy}/${mm}/Facture_${facture.numero}_${facture.id}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage
      .from('factures')
      .upload(path, buffer as any, { contentType: 'application/pdf', upsert: true });

    if (upErr) {
      // fallback direct si upload échoue
      return new NextResponse(buffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Facture_${facture.numero}.pdf"`,
          'X-Upload-Error': upErr.message,
        },
      });
    }

    // Redirection vers l'URL publique
    const { data: pub } = supabaseAdmin.storage.from('factures').getPublicUrl(path);
    const url = pub?.publicUrl;
    if (url) return NextResponse.redirect(url, 302);

    // fallback binaire
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Facture_${facture.numero}.pdf"`,
      },
    });
  } catch (e: any) {
    console.error('PDF error:', e?.message || e);
    return NextResponse.json({ error: e?.message || 'Erreur PDF' }, { status: 500 });
  }
}