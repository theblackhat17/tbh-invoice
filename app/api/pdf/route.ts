export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/* --------------------- Supabase helpers --------------------- */
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
    .from('prestations')              // ✅ ici
    .select('description, quantite, prix_unit')
    .eq('facture_id', id)
    .order('id');

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

/* --------------------- PDF Theme --------------------- */
const COLORS = {
  navy: rgb(0.05, 0.1, 0.22),
  blue: rgb(0.0, 0.45, 0.75),
  black: rgb(0.05, 0.05, 0.05),
  gray: rgb(0.4, 0.4, 0.4),
  lightGray: rgb(0.9, 0.9, 0.9),
  white: rgb(1, 1, 1),
  bgLight: rgb(0.98, 0.98, 0.99),
};

const A4 = { w: 595, h: 842 };
const M = 40;

function formatPrice(n: number) {
  return (
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + ' €'
  );
}

function wrapText(text: string, maxChars = 60) {
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/* --------------------- Route --------------------- */
export async function GET(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

    const f = await fetchFactureFull(id);

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const page = pdf.addPage([A4.w, A4.h]);
    let y = A4.h - M;

    // HEADER
    const headerH = 100;
    page.drawRectangle({ x: 0, y: A4.h - headerH, width: A4.w, height: headerH, color: COLORS.navy });

    page.drawText('TBH ONE', {
      x: M,
      y: A4.h - 50,
      size: 32,
      font: fontBold,
      color: COLORS.white,
    });

    const badgeW = 260;
    const badgeH = 56;
    const badgeX = A4.w - M - badgeW;
    const badgeY = A4.h - 32 - badgeH;

    page.drawRectangle({
      x: badgeX,
      y: badgeY,
      width: badgeW,
      height: badgeH,
      color: COLORS.white,
    });

    page.drawText(f.typeDocument.toUpperCase(), {
      x: badgeX + 15,
      y: badgeY + 34,
      size: 10,
      font: fontBold,
      color: COLORS.gray,
    });

    page.drawText(`N° ${f.numero}`, {
      x: badgeX + 15,
      y: badgeY + 16,
      size: 16,
      font: fontBold,
      color: COLORS.black,
    });

    y = A4.h - headerH - 20;

    // INFOS ENTREPRISE
    page.drawText('ENTREPRISE', { x: M, y, size: 9, font: fontBold, color: COLORS.gray });
    page.drawText('ADRESSE', { x: M + 180, y, size: 9, font: fontBold, color: COLORS.gray });
    page.drawText('SIRET', { x: M + 360, y, size: 9, font: fontBold, color: COLORS.gray });

    y -= 14;
    page.drawText('VANDEWALLE CLEMENT — TBH ONE', { x: M, y, size: 10, font, color: COLORS.black });
    page.drawText('39 Avenue Émile Zola, 59800 Lille', { x: M + 180, y, size: 10, font, color: COLORS.black });
    page.drawText('911 278 992 00019', { x: M + 360, y, size: 10, font, color: COLORS.black });

    y -= 24;
    const dateFR = new Date(f.date).toLocaleDateString('fr-FR');
    page.drawText(`Date : ${dateFR}`, { x: A4.w - M - 120, y, size: 10, font, color: COLORS.gray });

    y -= 30;

    // BLOC CLIENT
    const clientBoxH = 80;
    page.drawRectangle({
      x: M,
      y: y - clientBoxH,
      width: A4.w - 2 * M,
      height: clientBoxH,
      color: COLORS.bgLight,
      borderColor: COLORS.blue,
      borderWidth: 1.5,
    });

    page.drawText('FACTURÉ À', {
      x: M + 15,
      y: y - 16,
      size: 10,
      font: fontBold,
      color: COLORS.blue,
    });

    page.drawText(f.client.nom, {
      x: M + 15,
      y: y - 34,
      size: 14,
      font: fontBold,
      color: COLORS.black,
    });

    const addrLines = wrapText(f.client.adresse, 70);
    addrLines.slice(0, 2).forEach((line, i) => {
      page.drawText(line, {
        x: M + 15,
        y: y - 50 - i * 14,
        size: 10,
        font,
        color: COLORS.gray,
      });
    });

    y -= clientBoxH + 24;

    // TABLEAU PRESTATIONS
    const tableHeaderH = 28;
    const rowH = 24;

    const colDescX = M;
    const colQtyX = A4.w - M - 270;
    const colPUX = A4.w - M - 180;
    const colTotalX = A4.w - M - 90;

    page.drawRectangle({
      x: M - 5,
      y: y - tableHeaderH,
      width: A4.w - 2 * M + 10,
      height: tableHeaderH,
      color: COLORS.navy,
    });

    page.drawText('DESCRIPTION', { x: colDescX + 8, y: y - 18, size: 11, font: fontBold, color: COLORS.white });
    page.drawText('QTÉ', { x: colQtyX + 8, y: y - 18, size: 11, font: fontBold, color: COLORS.white });
    page.drawText('PRIX U.', { x: colPUX + 8, y: y - 18, size: 11, font: fontBold, color: COLORS.white });
    page.drawText('TOTAL', { x: colTotalX + 8, y: y - 18, size: 11, font: fontBold, color: COLORS.white });

    y -= tableHeaderH;

    f.prestations.forEach((p, idx) => {
      const total = p.quantite * p.prixUnit;

      if (idx % 2 === 1) {
        page.drawRectangle({
          x: M - 5,
          y: y - rowH,
          width: A4.w - 2 * M + 10,
          height: rowH,
          color: COLORS.bgLight,
        });
      }

      page.drawText(p.description.substring(0, 60), {
        x: colDescX + 8,
        y: y - 16,
        size: 10,
        font,
        color: COLORS.black,
      });

      page.drawText(String(p.quantite), {
        x: colQtyX + 20,
        y: y - 16,
        size: 10,
        font,
        color: COLORS.black,
      });

      page.drawText(formatPrice(p.prixUnit), {
        x: colPUX + 8,
        y: y - 16,
        size: 10,
        font,
        color: COLORS.black,
      });

      page.drawText(formatPrice(total), {
        x: colTotalX + 8,
        y: y - 16,
        size: 10,
        font: fontBold,
        color: COLORS.black,
      });

      y -= rowH;
    });

    y -= 16;

    // BLOC TOTAL
    const totalBoxW = 240;
    const totalBoxH = 70;
    const totalBoxX = A4.w - M - totalBoxW;
    const totalBoxY = y - totalBoxH;

    page.drawRectangle({
      x: totalBoxX,
      y: totalBoxY,
      width: totalBoxW,
      height: totalBoxH,
      color: COLORS.navy,
    });

    page.drawText('TOTAL HT', {
      x: totalBoxX + 20,
      y: totalBoxY + 44,
      size: 12,
      font: fontBold,
      color: COLORS.white,
    });

    page.drawText(formatPrice(f.totalHT), {
      x: totalBoxX + 20,
      y: totalBoxY + 20,
      size: 20,
      font: fontBold,
      color: COLORS.white,
    });

    page.drawText('TVA non applicable (art. 293B du CGI)', {
      x: M,
      y: totalBoxY + 28,
      size: 9,
      font,
      color: COLORS.gray,
    });

    // FOOTER
    const footerY = 80;
    page.drawRectangle({
      x: 0,
      y: 0,
      width: A4.w,
      height: footerY,
      color: COLORS.bgLight,
    });

    page.drawText('INFORMATIONS BANCAIRES', {
      x: M,
      y: 56,
      size: 9,
      font: fontBold,
      color: COLORS.navy,
    });

    page.drawText('IBAN : FR76 2823 3000 0153 3547 5796 770', {
      x: M,
      y: 40,
      size: 10,
      font,
      color: COLORS.black,
    });

    page.drawText('Titulaire : VANDEWALLE CLEMENT · REVOLUT', {
      x: M,
      y: 24,
      size: 10,
      font,
      color: COLORS.gray,
    });

    page.drawText('TBH ONE', {
      x: A4.w - M - 80,
      y: 24,
      size: 10,
      font: fontBold,
      color: COLORS.gray,
    });

    const pdfBytes = await pdf.save();
    const buffer = Buffer.from(pdfBytes);

    await ensureBucket();
    const yyyy = new Date(f.date).getFullYear();
    const mm = String(new Date(f.date).getMonth() + 1).padStart(2, '0');
    const path = `${yyyy}/${mm}/Facture_${f.numero}_${f.id}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage
      .from('factures')
      .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (upErr) {
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Facture_${f.numero}.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const { data: pub } = supabaseAdmin.storage.from('factures').getPublicUrl(path);
    if (pub?.publicUrl) return NextResponse.redirect(pub.publicUrl, 302);

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
