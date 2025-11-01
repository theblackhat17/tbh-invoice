// app/api/pdf/route.ts
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

/* --------------------- PDF helpers & theme --------------------- */
const THEME = {
  primary: rgb(0.05, 0.10, 0.22),    // #0d1a38
  accent:  rgb(0.01, 0.52, 0.78),    // #0284c7
  dark:    rgb(0.12, 0.12, 0.13),    // #1f2021
  mid:     rgb(0.55, 0.55, 0.58),    // zinc-500
  light:   rgb(0.965, 0.965, 0.975), // fond clair
  white:   rgb(1, 1, 1),
  rowAlt:  rgb(0.98, 0.98, 0.985),
};

const A4 = { w: 595, h: 842 };
const MARGIN = 50;
const TABLE = {
  colDesc: MARGIN,
  colQty:  MARGIN + 300,
  colPU:   MARGIN + 390,
  colTot:  MARGIN + 475,
  width:   A4.w - MARGIN * 2,
  headerH: 26,
  rowH:    22,
};
const SAFE_BOTTOM = 90; // on garde de la place pour le footer

function wrapText(text: string, maxChars = 72) {
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (t.length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function currency(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

/* --------------------- Route --------------------- */
export async function GET(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });

    const f = await fetchFactureFull(id);

    const pdf = await PDFDocument.create();
    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([A4.w, A4.h]);
    let currentY = A4.h - MARGIN;

    /* ---------- Header bande + cartouche ---------- */
    const headerH = 96;
    page.drawRectangle({ x: 0, y: A4.h - headerH, width: A4.w, height: headerH, color: THEME.primary });

    // Branding
    page.drawText('TBH ONE', { x: MARGIN, y: A4.h - 36, size: 28, font: helvBold, color: THEME.white });

    // Cartouche type + numéro
    const badgeW = 230, badgeH = 50, badgeX = A4.w - MARGIN - badgeW, badgeY = A4.h - 30 - badgeH;
    page.drawRectangle({ x: badgeX, y: badgeY, width: badgeW, height: badgeH, color: THEME.white });
    page.drawText(f.typeDocument.toUpperCase(), { x: badgeX + 12, y: badgeY + 30, size: 10, font: helvBold, color: THEME.primary });
    page.drawText(`N° ${f.numero}`,           { x: badgeX + 12, y: badgeY + 12, size: 14, font: helvBold, color: THEME.dark });

    // Bande inférieure coordonnés + date
    const topBelowHeader = A4.h - headerH - 18;
    page.drawText('VANDEWALLE CLEMENT — TBH ONE', { x: MARGIN, y: topBelowHeader, size: 10, font: helv, color: THEME.dark });
    page.drawText('39 Avenue Émile Zola, 59800 Lille', { x: MARGIN, y: topBelowHeader - 14, size: 9, font: helv, color: THEME.mid });
    page.drawText('SIRET : 911 278 992 00019', { x: MARGIN, y: topBelowHeader - 28, size: 9, font: helv, color: THEME.mid });

    const dateFR = new Date(f.date).toLocaleDateString('fr-FR');
    page.drawText(dateFR, { x: badgeX, y: topBelowHeader - 28, size: 10, font: helv, color: THEME.mid });

    currentY = topBelowHeader - 44;

    /* ---------- Bloc client ---------- */
    const cardH = 74;
    page.drawRectangle({
      x: MARGIN, y: currentY - cardH + 4,
      width: A4.w - MARGIN * 2, height: cardH,
      color: THEME.light, borderColor: THEME.accent, borderWidth: 1.5,
    });
    page.drawText('FACTURÉ À', { x: MARGIN + 12, y: currentY - 10, size: 9, font: helvBold, color: THEME.accent });
    page.drawText(f.client.nom, { x: MARGIN + 12, y: currentY - 26, size: 12, font: helvBold, color: THEME.dark });

    const addrLines = wrapText(f.client.adresse, 70);
    addrLines.slice(0, 2).forEach((ln, i) => {
      page.drawText(ln, { x: MARGIN + 12, y: currentY - 42 - i * 12, size: 10, font: helv, color: THEME.mid });
    });

    currentY -= (cardH + 16);

    /* ---------- Fonctions tableau multipage ---------- */
    const drawTableHeader = () => {
      page.drawRectangle({ x: MARGIN - 5, y: currentY, width: TABLE.width + 10, height: TABLE.headerH, color: THEME.primary });
      page.drawText('DESCRIPTION', { x: TABLE.colDesc + 4, y: currentY + 6, size: 10, font: helvBold, color: THEME.white });
      page.drawText('QTÉ',         { x: TABLE.colQty,     y: currentY + 6, size: 10, font: helvBold, color: THEME.white });
      page.drawText('PRIX U.',     { x: TABLE.colPU,      y: currentY + 6, size: 10, font: helvBold, color: THEME.white });
      page.drawText('TOTAL',       { x: TABLE.colTot,     y: currentY + 6, size: 10, font: helvBold, color: THEME.white });
      currentY -= TABLE.headerH;
    };

    const drawFooter = (pageNum: number, totalPages?: number) => {
      const footerH = 82;
      page.drawRectangle({ x: 0, y: 0, width: A4.w, height: footerH, color: rgb(0.96, 0.965, 0.97) });
      page.drawText('INFORMATIONS BANCAIRES', { x: MARGIN, y: 58, size: 8, font: helvBold, color: THEME.primary });
      page.drawText('IBAN : FR76 2823 3000 0153 3547 5796 770', { x: MARGIN, y: 44, size: 9, font: helv, color: THEME.dark });
      page.drawText('Titulaire : VANDEWALLE CLEMENT · REVOLUT', { x: MARGIN, y: 30, size: 9, font: helv, color: THEME.mid });

      const label = totalPages ? `Page ${pageNum}/${totalPages}` : `Page ${pageNum}`;
      page.drawText(label, { x: A4.w - MARGIN - 70, y: 14, size: 9, font: helv, color: THEME.mid });
    };

    const newPage = (pageNum: number) => {
      drawFooter(pageNum);
      page = pdf.addPage([A4.w, A4.h]);
      currentY = A4.h - MARGIN;
      // Redessiner un petit header de section sur les pages suivantes
      page.drawText('TBH ONE — Prestations (suite)', { x: MARGIN, y: currentY, size: 10, font: helvBold, color: THEME.mid });
      currentY -= 18;
      drawTableHeader();
    };

    /* ---------- Tableau (avec pagination) ---------- */
    let pageNum = 1;
    drawTableHeader();

    for (let i = 0; i < f.prestations.length; i++) {
      const p = f.prestations[i];
      const descLines = wrapText(p.description, 72);
      const neededHeight = Math.max(TABLE.rowH, 14 + (descLines.length - 1) * 12);

      if (currentY - neededHeight < SAFE_BOTTOM) {
        newPage(++pageNum);
      }

      // alternance
      if (i % 2 === 0) {
        page.drawRectangle({
          x: MARGIN - 5, y: currentY - neededHeight + 4, width: TABLE.width + 10, height: neededHeight,
          color: THEME.rowAlt,
        });
      }

      // description multilignes
      descLines.forEach((ln, idx) => {
        page.drawText(ln, {
          x: TABLE.colDesc + 4,
          y: currentY - 2 - idx * 12,
          size: 9,
          font: helv,
          color: THEME.dark,
        });
      });

      // autres colonnes (alignées sur la 1re ligne)
      page.drawText(String(p.quantite), { x: TABLE.colQty + 12, y: currentY - 2, size: 9, font: helv, color: THEME.dark });
      page.drawText(currency(p.prixUnit), { x: TABLE.colPU, y: currentY - 2, size: 9, font: helv, color: THEME.dark });
      page.drawText(currency(p.quantite * p.prixUnit), { x: TABLE.colTot, y: currentY - 2, size: 9, font: helvBold, color: THEME.dark });

      currentY -= neededHeight;
    }

    // séparateur fin de tableau
    page.drawRectangle({ x: MARGIN - 5, y: currentY + 6, width: TABLE.width + 10, height: 1, color: THEME.light });

    /* ---------- Bloc total ---------- */
    const totalCardW = 230, totalCardH = 62;
    const totalX = A4.w - MARGIN - totalCardW;
    const totalY = currentY - 40;

    if (totalY < SAFE_BOTTOM) {
      newPage(++pageNum);
    }

    page.drawRectangle({ x: totalX, y: totalY, width: totalCardW, height: totalCardH, color: THEME.primary });
    page.drawText('TOTAL HT', { x: totalX + 14, y: totalY + 38, size: 11, font: helvBold, color: THEME.white });
    page.drawText(currency(f.totalHT), { x: totalX + 14, y: totalY + 18, size: 18, font: helvBold, color: THEME.white });

    page.drawText('TVA non applicable (art. 293B du CGI)', {
      x: totalX - 260,
      y: totalY + 10,
      size: 8,
      font: helv,
      color: THEME.mid,
    });

    // Footer de la dernière page avec numérotation finale
    const totalPages = pageNum;
    page.drawRectangle({ x: 0, y: 0, width: A4.w, height: 82, color: rgb(0.96, 0.965, 0.97) });
    page.drawText('INFORMATIONS BANCAIRES', { x: MARGIN, y: 58, size: 8, font: helvBold, color: THEME.primary });
    page.drawText('IBAN : FR76 2823 3000 0153 3547 5796 770', { x: MARGIN, y: 44, size: 9, font: helv, color: THEME.dark });
    page.drawText('Titulaire : VANDEWALLE CLEMENT · REVOLUT', { x: MARGIN, y: 30, size: 9, font: helv, color: THEME.mid });
    page.drawText(`Page ${totalPages}/${totalPages}`, { x: A4.w - MARGIN - 90, y: 14, size: 9, font: helv, color: THEME.mid });

    /* ---------- Save & Upload ---------- */
    const pdfBytes = await pdf.save();      // Uint8Array
    const buffer   = Buffer.from(pdfBytes); // pour fallback download

    await ensureBucket();
    const yyyy = new Date(f.date).getFullYear();
    const mm = String(new Date(f.date).getMonth() + 1).padStart(2, '0');
    const path = `${yyyy}/${mm}/Facture_${f.numero}_${f.id}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage
      .from('factures')
      .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (upErr) {
      // fallback: téléchargement direct
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
