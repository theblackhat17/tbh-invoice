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

    // === Génération PDF moderne et élégant ===
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // Couleurs modernes
    const primary = rgb(0.0078, 0.0392, 0.1294);     // Bleu #0d1530ff
    const secondary = rgb(0.008, 0.518, 0.780);    // Cyan #0284C7
    const dark = rgb(0.091, 0.091, 0.091);         // Gris foncé #171717
    const lightGray = rgb(0.965, 0.965, 0.965);    // Gris clair #F6F6F6
    const mediumGray = rgb(0.556, 0.556, 0.576);   // Zinc-500
    const white = rgb(1, 1, 1);

    // === HEADER AVEC BANDE BLEUE ===
    // Bande bleue en haut
    page.drawRectangle({
      x: 0,
      y: 792,
      width: 595,
      height: 100,
      color: primary,
    });

    // Logo/Nom entreprise (blanc sur bleu)
    page.drawText('TBH', {
      x: 50,
      y: 750,
      size: 32,
      font: helvBold,
      color: white,
    });
    page.drawText('ONE', {
      x: 110,
      y: 750,
      size: 32,
      font: helvBold,
      color: white,
    });

    // Sous-titre
    page.drawText('', {
      x: 50,
      y: 807,
      size: 8,
      font: helv,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Infos entreprise (blanc)
    page.drawText('VANDEWALLE CLEMENT', { x: 50, y: 780, size: 9, font: helv, color: white });
    page.drawText('39 Avenue Émile Zola, 59800 Lille', { x: 50, y: 767, size: 9, font: helv, color: white });
    page.drawText('SIRET : 911 278 992 00019', { x: 50, y: 754, size: 9, font: helv, color: white });

    // Type de document + Numéro (encadré blanc à droite)
    page.drawRectangle({
      x: 370,
      y: 772,
      width: 175,
      height: 50,
      color: white,
      borderColor: white,
      borderWidth: 1,
    });

    page.drawText(f.typeDocument.toUpperCase(), {
      x: 380,
      y: 805,
      size: 10,
      font: helvBold,
      color: primary,
    });

    page.drawText(`N° ${f.numero}`, {
      x: 380,
      y: 787,
      size: 16,
      font: helvBold,
      color: dark,
    });

    // Date
    const dateFR = new Date(f.date).toLocaleDateString('fr-FR');
    page.drawText(dateFR, {
      x: 380,
      y: 770,
      size: 9,
      font: helv,
      color: mediumGray,
    });

    // === BLOC CLIENT (encadré moderne) ===
    page.drawRectangle({
      x: 50,
      y: 630,
      width: 250,
      height: 80,
      color: lightGray,
      borderColor: primary,
      borderWidth: 2,
    });

    page.drawText('FACTURÉ À', {
      x: 60,
      y: 695,
      size: 9,
      font: helvBold,
      color: primary,
    });

    page.drawText(f.client.nom, {
      x: 60,
      y: 675,
      size: 11,
      font: helvBold,
      color: dark,
    });

    page.drawText(f.client.adresse, {
      x: 60,
      y: 658,
      size: 9,
      font: helv,
      color: mediumGray,
    });

    // === TABLEAU DES PRESTATIONS (design moderne) ===
    let tableY = 590;
    const col1 = 50;
    const col2 = 340;
    const col3 = 420;
    const col4 = 500;

    // En-tête du tableau (fond bleu)
    page.drawRectangle({
      x: 45,
      y: tableY - 5,
      width: 505,
      height: 25,
      color: primary,
    });

    page.drawText('DESCRIPTION', { x: col1 + 5, y: tableY + 3, size: 10, font: helvBold, color: white });
    page.drawText('QTÉ', { x: col2, y: tableY + 3, size: 10, font: helvBold, color: white });
    page.drawText('PRIX U.', { x: col3, y: tableY + 3, size: 10, font: helvBold, color: white });
    page.drawText('TOTAL', { x: col4, y: tableY + 3, size: 10, font: helvBold, color: white });

    tableY -= 30;

    // Lignes du tableau (alternance de couleurs)
    f.prestations.forEach((p, index) => {
      // Fond alterné
      if (index % 2 === 0) {
        page.drawRectangle({
          x: 45,
          y: tableY - 5,
          width: 505,
          height: 22,
          color: rgb(0.98, 0.98, 0.98),
        });
      }

      const desc = p.description.length > 45 ? p.description.slice(0, 42) + '...' : p.description;
      
      page.drawText(desc, { x: col1 + 5, y: tableY, size: 9, font: helv, color: dark });
      page.drawText(String(p.quantite), { x: col2 + 10, y: tableY, size: 9, font: helv, color: dark });
      page.drawText(`${p.prixUnit.toFixed(2)} €`, { x: col3, y: tableY, size: 9, font: helv, color: dark });
      page.drawText(`${(p.quantite * p.prixUnit).toFixed(2)} €`, { x: col4, y: tableY, size: 9, font: helvBold, color: dark });
      
      tableY -= 24;
    });

    // Ligne de séparation
    page.drawLine({
      start: { x: 45, y: tableY + 10 },
      end: { x: 550, y: tableY + 10 },
      thickness: 1,
      color: lightGray,
    });

    // === TOTAL (encadré bleu moderne) ===
    tableY -= 30;
    page.drawRectangle({
      x: 380,
      y: tableY - 10,
      width: 170,
      height: 45,
      color: primary,
    });

    page.drawText('TOTAL HT', {
      x: 390,
      y: tableY + 15,
      size: 11,
      font: helvBold,
      color: white,
    });

    page.drawText(`${f.totalHT.toFixed(2)} €`, {
      x: 450,
      y: tableY + 15,
      size: 18,
      font: helvBold,
      color: white,
    });

    page.drawText('TVA non applicable', {
      x: 390,
      y: tableY - 2,
      size: 8,
      font: helv,
      color: rgb(0.9, 0.9, 0.9),
    });

    // === FOOTER (bande grise élégante) ===
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 595,
      height: 80,
      color: rgb(0.95, 0.95, 0.95),
    });

    // Infos de paiement
    page.drawText('INFORMATIONS BANCAIRES', {
      x: 50,
      y: 60,
      size: 8,
      font: helvBold,
      color: primary,
    });

    page.drawText('IBAN : FR76 2823 3000 0153 3547 5796 770', {
      x: 50,
      y: 45,
      size: 9,
      font: helv,
      color: dark,
    });

    page.drawText('Titulaire : VANDEWALLE CLEMENT | REVOLUT', {
      x: 50,
      y: 32,
      size: 9,
      font: helv,
      color: mediumGray,
    });

    // Note légale
    page.drawText('TVA non applicable, article 293B du CGI', {
      x: 50,
      y: 15,
      size: 7,
      font: helv,
      color: mediumGray,
    });

    // Petit logo/watermark en bas à droite
    page.drawText('TBH ONE', {
      x: 480,
      y: 40,
      size: 14,
      font: helvBold,
      color: lightGray,
    });

    const pdfBytes = await pdf.save();
    const buffer = Buffer.from(pdfBytes);

    // === Upload Supabase ===
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
          'X-Upload-Error': upErr.message,
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