// app/api/pdf/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

    // === Génération PDF avec pdf-lib (pas de polices externes) ===
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4 portrait
    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const drawText = (
      text: string,
      x: number,
      y: number,
      size = 12,
      color = rgb(0, 0, 0),
      bold = false
    ) => {
      page.drawText(text, {
        x,
        y,
        size,
        color,
        font: bold ? helvBold : helv,
      });
    };

    // Marges
    const left = 50;
    let y = 792; // top (842) - 50
    const lineGap = 16;

    // En-tête
    drawText('TBH ONE', left, y, 24, rgb(0, 0, 0), true);
    y -= lineGap * 2;
    drawText('VANDEWALLE CLEMENT', left, y, 10); y -= lineGap;
    drawText('39 Avenue Émile Zola', left, y, 10); y -= lineGap;
    drawText('59800 Lille', left, y, 10); y -= lineGap;
    drawText('Siret : 91127899200019', left, y, 10);

    // Titre à droite
    const rightX = 350;
    y = 792 - lineGap; // remonte un peu
    drawText(`${f.typeDocument} N°${f.numero}`, rightX, y, 18, rgb(0,0,0), true);

    // Client + date
    y = 842 - 200;
    drawText('Client :', rightX, y, 12, rgb(0,0,0), true); y -= lineGap;
    drawText(`${f.client.nom}`, rightX, y, 10); y -= lineGap;
    drawText(`Adresse : ${f.client.adresse}`, rightX, y, 10);

    const dateFR = new Date(f.date).toLocaleDateString('fr-FR');
    drawText(`Date : ${dateFR}`, rightX, y - lineGap, 10, rgb(0.905, 0.298, 0.235));

    // Tableau
    let tableY = 842 - 300;
    const col1 = left;
    const col2 = 350;
    const col3 = 450;
    const col4 = 520;

    // En-têtes
    drawText('Prestation', col1, tableY, 11, rgb(0,0,0), true);
    drawText('Quantité',   col2, tableY, 11, rgb(0,0,0), true);
    drawText('Prix unit.', col3, tableY, 11, rgb(0,0,0), true);
    drawText('Total',      col4, tableY, 11, rgb(0,0,0), true);
    tableY -= lineGap;

    // Lignes
    for (const p of f.prestations) {
      // (simple wrap : coupe si trop long)
      const desc = p.description.length > 60 ? p.description.slice(0, 57) + '…' : p.description;
      drawText(desc, col1, tableY, 10);
      drawText(String(p.quantite), col2, tableY, 10);
      drawText(`${p.prixUnit.toFixed(2)} €`, col3, tableY, 10);
      drawText(`${(p.quantite * p.prixUnit).toFixed(2)} €`, col4, tableY, 10);
      tableY -= lineGap;
    }

    // Total
    tableY -= 10;
    drawText('Total HT :', col3, tableY, 14, rgb(0,0,0), true);
    drawText(`${f.totalHT.toFixed(2)} €`, col4, tableY, 14, rgb(0,0,0), true);

    // Pied de page
    drawText('IBAN : FR76 2823 3000 0153 3547 5796 770 | REVOLUT', left, 70, 9, rgb(0.4,0.4,0.4));
    drawText('Nom/Prénom : VANDEWALLE CLEMENT', left, 54, 9, rgb(0.4,0.4,0.4));
    drawText('TVA non applicable, article 293B du CGI', left, 38, 9, rgb(0.4,0.4,0.4));

    const pdfBytes = await pdf.save(); // Uint8Array
    const buffer = Buffer.from(pdfBytes); // Conversion sûre pour NextResponse

    // === Upload Supabase ===
    await ensureBucket();
    const yyyy = new Date(f.date).getFullYear();
    const mm = String(new Date(f.date).getMonth() + 1).padStart(2, '0');
    const path = `${yyyy}/${mm}/Facture_${f.numero}_${f.id}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage
      .from('factures')
      .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (upErr) {
      // renvoyer le PDF quand même
      return new NextResponse(buffer, {
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

    // fallback binaire
    return new NextResponse(buffer, {
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
