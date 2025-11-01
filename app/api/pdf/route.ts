// app/api/pdf/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/* ------------------------------ Supabase ------------------------------ */

async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.listBuckets();
  if (!data?.some((b) => b.name === 'factures')) {
    await supabaseAdmin.storage
      .createBucket('factures', { public: true, fileSizeLimit: '20mb' })
      .catch(() => void 0);
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

/* ------------------------------ Helpers PDF ------------------------------ */

type Fonts = {
  helv: any;
  helvBold: any;
};

function wrapText(txt: string, maxChars = 60) {
  if (!txt) return [''];
  const words = txt.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawLabeledValue(
  page: any,
  label: string,
  value: string,
  x: number,
  y: number,
  fonts: Fonts,
  labelSize = 9,
  valueSize = 10,
  labelColor = rgb(0.35, 0.35, 0.4),
  valueColor = rgb(0.12, 0.12, 0.12)
) {
  page.drawText(label, { x, y, size: labelSize, font: fonts.helvBold, color: labelColor });
  page.drawText(value, { x, y: y - 13, size: valueSize, font: fonts.helv, color: valueColor });
}

/* ------------------------------ Route ------------------------------ */

export async function GET(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

    const f = await fetchFactureFull(id);

    // === PDF setup ===
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fonts: Fonts = { helv, helvBold };

    // Palette moderne
    const primary = rgb(0.05, 0.10, 0.22);   // #0d1a38
    const accent  = rgb(0.01, 0.52, 0.78);   // #0284c7
    const dark    = rgb(0.10, 0.10, 0.10);   // #191919
    const light   = rgb(0.965, 0.965, 0.975); // gris clair
    const mid     = rgb(0.55, 0.55, 0.58);   // zinc-500
    const white   = rgb(1, 1, 1);

    const pageW = 595;
    const pageH = 842;
    const margin = 50;

    /* ------------------------------ Header ------------------------------ */

    const headerH = 96;
    page.drawRectangle({ x: 0, y: pageH - headerH, width: pageW, height: headerH, color: primary });

    // Logo / branding (blanc sur bande)
    page.drawText('TBH ONE', {
      x: margin,
      y: pageH - 34,
      size: 28,
      font: helvBold,
      color: white,
    });

    // Cartouche Type + Numéro (à droite, dans la bande)
    const badgeW = 220;
    const badgeH = 48;
    const badgeX = pageW - margin - badgeW;
    const badgeY = pageH - 30 - badgeH;

    page.drawRectangle({ x: badgeX, y: badgeY, width: badgeW, height: badgeH, color: white });
    page.drawText(f.typeDocument.toUpperCase(), {
      x: badgeX + 12,
      y: badgeY + 28,
      size: 10,
      font: helvBold,
      color: primary,
    });
    page.drawText(`N° ${f.numero}`, {
      x: badgeX + 12,
      y: badgeY + 10,
      size: 14,
      font: helvBold,
      color: dark,
    });

    // Coordonnées société (sous la bande, couleurs lisibles)
    const topBelowHeader = pageH - headerH - 18;
    drawLabeledValue(page, 'ENTREPRISE', 'VANDEWALLE CLEMENT — TBH ONE', margin, topBelowHeader, fonts);
    drawLabeledValue(page, 'ADRESSE', '39 Avenue Émile Zola, 59800 Lille', margin + 210, topBelowHeader, fonts);
    drawLabeledValue(page, 'SIRET', '911 278 992 00019', margin + 420, topBelowHeader, fonts);

    // Date à droite sous la bande
    const dateFR = new Date(f.date).toLocaleDateString('fr-FR');
    page.drawText(dateFR, {
      x: badgeX,
      y: topBelowHeader - 26,
      size: 10,
      font: helv,
      color: mid,
    });

    /* ------------------------------ Bloc client ------------------------------ */

    // Carte "client" (verre dépoli: fond clair + bord accent)
    const clientCardY = topBelowHeader - 80;
    page.drawRectangle({
      x: margin,
      y: clientCardY,
      width: pageW - margin * 2,
      height: 70,
      color: light,
      borderColor: accent,
      borderWidth: 1.5,
    });

    page.drawText('FACTURÉ À', {
      x: margin + 12,
      y: clientCardY + 48,
      size: 9,
      font: helvBold,
      color: accent,
    });

    page.drawText(f.client.nom, {
      x: margin + 12,
      y: clientCardY + 30,
      size: 12,
      font: helvBold,
      color: dark,
    });

    // Adresse (wrap)
    const addressLines = wrapText(f.client.adresse, 70);
    addressLines.slice(0, 2).forEach((ln, i) => {
      page.drawText(ln, {
        x: margin + 12,
        y: clientCardY + 14 - i * 12,
        size: 10,
        font: helv,
        color: mid,
      });
    });

    /* ------------------------------ Tableau prestations ------------------------------ */

    let tableY = clientCardY - 24;
    const colDesc = margin;
    const colQty  = margin + 300;
    const colPU   = margin + 380;
    const colTot  = margin + 470;
    const tableW  = pageW - margin * 2;

    // En-tête
    page.drawRectangle({ x: margin - 5, y: tableY, width: tableW + 10, height: 26, color: primary });
    page.drawText('DESCRIPTION', { x: colDesc + 4, y: tableY + 6, size: 10, font: helvBold, color: white });
    page.drawText('QTÉ',         { x: colQty,       y: tableY + 6, size: 10, font: helvBold, color: white });
    page.drawText('PRIX U.',     { x: colPU,        y: tableY + 6, size: 10, font: helvBold, color: white });
    page.drawText('TOTAL',       { x: colTot,       y: tableY + 6, size: 10, font: helvBold, color: white });

    tableY -= 24;

    const rowH = 22;
    f.prestations.forEach((p, i) => {
      const isEven = i % 2 === 0;
      if (isEven) {
        page.drawRectangle({ x: margin - 5, y: tableY - 4, width: tableW + 10, height: rowH, color: rgb(0.98, 0.98, 0.985) });
      }

      // Description avec coupe douce
      const desc = p.description.length > 72 ? p.description.slice(0, 69) + '…' : p.description;
      page.drawText(desc, { x: colDesc + 4, y: tableY + 2, size: 9, font: helv, color: dark });
      page.drawText(String(p.quantite), { x: colQty + 12, y: tableY + 2, size: 9, font: helv, color: dark });
      page.drawText(`${p.prixUnit.toFixed(2)} €`, { x: colPU, y: tableY + 2, size: 9, font: helv, color: dark });
      page.drawText(`${(p.quantite * p.prixUnit).toFixed(2)} €`, { x: colTot, y: tableY + 2, size: 9, font: helvBold, color: dark });

      tableY -= rowH;
    });

    // Séparateur fin de tableau
    page.drawRectangle({ x: margin - 5, y: tableY + 6, width: tableW + 10, height: 1, color: light });

    /* ------------------------------ Bloc total ------------------------------ */

    const totalCardW = 210;
    const totalCardH = 60;
    const totalX = pageW - margin - totalCardW;
    const totalY = tableY - 36;

    // Carte total en accent (coins doux)
    page.drawRectangle({ x: totalX, y: totalY, width: totalCardW, height: totalCardH, color: primary });
    page.drawText('TOTAL HT', { x: totalX + 14, y: totalY + 36, size: 11, font: helvBold, color: white });
    page.drawText(`${f.totalHT.toFixed(2)} €`, { x: totalX + 14, y: totalY + 16, size: 18, font: helvBold, color: white });

    // Mention TVA
    page.drawText('TVA non applicable (art. 293B du CGI)', {
      x: totalX - 250,
      y: totalY + 8,
      size: 8,
      font: helv,
      color: mid,
    });

    /* ------------------------------ Footer ------------------------------ */

    const footerH = 82;
    page.drawRectangle({ x: 0, y: 0, width: pageW, height: footerH, color: rgb(0.96, 0.965, 0.97) });

    page.drawText('INFORMATIONS BANCAIRES', { x: margin, y: 58, size: 8, font: helvBold, color: primary });
    page.drawText('IBAN : FR76 2823 3000 0153 3547 5796 770', { x: margin, y: 44, size: 9, font: helv, color: dark });
    page.drawText('Titulaire : VANDEWALLE CLEMENT · REVOLUT', { x: margin, y: 30, size: 9, font: helv, color: mid });

    page.drawText('TBH ONE', { x: pageW - margin - 60, y: 34, size: 12, font: helvBold, color: rgb(0.88, 0.89, 0.90) });

    /* ------------------------------ Save & Upload ------------------------------ */

    const pdfBytes = await pdf.save(); // Uint8Array (parfait pour Supabase upload)
    const buffer = Buffer.from(pdfBytes); // pour fallback download

    await ensureBucket();
    const yyyy = new Date(f.date).getFullYear();
    const mm = String(new Date(f.date).getMonth() + 1).padStart(2, '0');
    const path = `${yyyy}/${mm}/Facture_${f.numero}_${f.id}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage
      .from('factures')
      .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (upErr) {
      // fallback: download direct si l’upload échoue
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

    // dernier fallback
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
