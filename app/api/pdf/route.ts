// app/api/pdf/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import fontkit from 'fontkit';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const pdfToBuffer = (doc: InstanceType<typeof PDFDocument>) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.listBuckets();
  if (!data?.some((b) => b.name === 'factures')) {
    await supabaseAdmin.storage.createBucket('factures', {
      public: true,
      fileSizeLimit: '20mb',
    }).catch(() => void 0);
  }
}

async function fetchFactureFull(id: string) {
  const { data: facture, error } = await supabaseAdmin
    .from('factures')
    .select(`
      id, numero, date, type_document, total_ht,
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
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

    const f = await fetchFactureFull(id);

    // --- Enregistrer des polices TTF depuis le disque ---
    const fontsDir = join(process.cwd(), 'app', 'api', 'pdf', 'fonts');
    let regular: Buffer | undefined;
    let bold: Buffer | undefined;
    try {
      regular = readFileSync(join(fontsDir, 'Inter-Regular.ttf'));
      bold    = readFileSync(join(fontsDir, 'Inter-Bold.ttf'));
    } catch {
      // Pas de crash : on tombera sur les polices de base de PDFKit
    }

    const doc = new PDFDocument({ margin: 50 });
    (doc as any).registerFont && fontkit; // force l’enregistrement du moteur

    if (regular) doc.registerFont('Regular', regular);
    if (bold)    doc.registerFont('Bold', bold);

    const use = (name: 'Regular' | 'Bold') =>
      (regular || bold) ? doc.font(name) : doc.font(name === 'Bold' ? 'Helvetica-Bold' : 'Helvetica');

    // En-tête
    use('Bold').fontSize(24).text('TBH ONE', 50, 50);
    use('Regular').fontSize(10)
      .text('VANDEWALLE CLEMENT', 50, 80)
      .text('39 Avenue Émile Zola', 50, 95)
      .text('59800 Lille', 50, 110)
      .text('Siret : 91127899200019', 50, 125);
    use('Bold').fontSize(20)
      .text(`${f.typeDocument} N°${f.numero}`, 350, 50, { align: 'right' });

    // Client + date
    use('Bold').fontSize(12).text('Client :', 350, 120);
    use('Regular').fontSize(10)
      .text(f.client.nom, 350, 140)
      .text(`Adresse : ${f.client.adresse}`, 350, 155);

    const dateFR = new Date(f.date).toLocaleDateString('fr-FR');
    doc.fillColor('#e74c3c').fontSize(10).text(`Date : ${dateFR}`, 350, 185, { align: 'right' });
    doc.fillColor('black');

    // Tableau
    const tableTop = 250, col1 = 50, col2 = 350, col3 = 450, col4 = 520;
    use('Bold').fontSize(11);
    doc.rect(col1, tableTop, 500, 25).fillAndStroke('#f0f0f0', '#cccccc');
    doc.fillColor('#000')
      .text('Prestation', col1 + 5, tableTop + 7)
      .text('Quantité',   col2 + 5, tableTop + 7)
      .text('Prix unit.', col3 + 5, tableTop + 7)
      .text('Total',      col4 + 5, tableTop + 7);

    let y = tableTop + 35;
    use('Regular').fontSize(10);
    (f.prestations ?? []).forEach((p, i) => {
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
    use('Bold').fontSize(14);
    doc.rect(col3 - 10, y, 162, 30).fillAndStroke('#3b82f6', '#3b82f6');
    doc.fillColor('#fff')
      .text('Total HT :', col3, y + 8)
      .text(`${f.totalHT.toFixed(2)} €`, col4, y + 8, { align: 'right' });

    // Footer
    use('Regular').fontSize(9).fillColor('#666');
    doc.text('IBAN : FR76 2823 3000 0153 3547 5796 770 | REVOLUT', 50, 700);
    doc.text('Nom/Prénom : VANDEWALLE CLEMENT', 50, 715);
    doc.text('TVA non applicable, article 293B du CGI', 50, 745, { align: 'center' });

    doc.end();
    const buf = await pdfToBuffer(doc);

    // Upload via Uint8Array (pas de Blob)
    const ab    = toArrayBuffer(buf);
    const uint8 = new Uint8Array(ab);

    await ensureBucket();
    const yyyy = new Date(f.date).getFullYear();
    const mm   = String(new Date(f.date).getMonth() + 1).padStart(2, '0');
    const path = `${yyyy}/${mm}/Facture_${f.numero}_${f.id}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage
      .from('factures')
      .upload(path, uint8, { contentType: 'application/pdf', upsert: true });

    if (upErr) {
      return new NextResponse(ab, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Facture_${f.numero}.pdf"`,
          'X-Upload-Error': upErr.message,
          'Cache-Control': 'no-store',
        },
      });
    }

    const { data: pub } = supabaseAdmin.storage.from('factures').getPublicUrl(path);
    if (pub?.publicUrl) return NextResponse.redirect(pub.publicUrl, 302);

    return new NextResponse(ab, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Facture_${f.numero}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error('PDF error:', e?.message || e);
    return NextResponse.json({ error: e?.message || 'Erreur PDF' }, { status: 500 });
  }
}
