import { NextRequest, NextResponse } from 'next/server';
import { getFactureById, getClientById } from '@/lib/db';
import PDFDocument from 'pdfkit';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
    }

    // Récupérer la facture
    const facture = getFactureById(id);

    if (!facture) {
      return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
    }

    // Récupérer le client
    const client = getClientById(facture.clientId);

    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    // Créer le PDF
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    return new Promise<Response>((resolve) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(
          new Response(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="Facture_${facture.numero}.pdf"`,
            },
          })
        );
      });

      // === En-tête ===
      doc.fontSize(24).font('Helvetica-Bold').text('TBH ONE', 50, 50);
      doc.fontSize(10).font('Helvetica')
        .text('VANDEWALLE CLEMENT', 50, 80)
        .text('39 Avenue émile Zola', 50, 95)
        .text('59800 Lille', 50, 110)
        .text('Siret : 91127899200019', 50, 125);

      // Numéro de facture (à droite)
      doc.fontSize(20).font('Helvetica-Bold')
        .text(`${facture.typeDocument} N°${facture.numero}`, 350, 50, { align: 'right' });

      // === Informations client ===
      doc.fontSize(12).font('Helvetica-Bold').text('Client :', 350, 120);
      doc.fontSize(10).font('Helvetica')
        .text(client.nom, 350, 140)
        .text(`Adresse : ${client.adresse}`, 350, 155);

      // Date
      const dateFormatee = new Date(facture.date).toLocaleDateString('fr-FR');
      doc.fontSize(10).font('Helvetica')
        .text(`Date : ${dateFormatee}`, 350, 185, { 
          align: 'right',
          color: '#e74c3c'
        });

      // === Tableau des prestations ===
      const tableTop = 250;
      const col1 = 50;
      const col2 = 350;
      const col3 = 450;
      const col4 = 500;

      // En-têtes du tableau
      doc.fontSize(11).font('Helvetica-Bold');
      doc.rect(col1, tableTop, 545, 25).fillAndStroke('#f0f0f0', '#cccccc');
      doc.fillColor('#000000')
        .text('Prestation', col1 + 5, tableTop + 7)
        .text('Quantité', col2 + 5, tableTop + 7)
        .text('Prix unit.', col3 + 5, tableTop + 7)
        .text('Total', col4 + 5, tableTop + 7);

      // Lignes des prestations
      let currentY = tableTop + 35;
      doc.font('Helvetica').fontSize(10);

      facture.prestations.forEach((prestation, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
        doc.rect(col1, currentY - 5, 545, 25).fillAndStroke(bgColor, '#e0e0e0');
        
        doc.fillColor('#000000')
          .text(prestation.description, col1 + 5, currentY, { width: 290 })
          .text(prestation.quantite.toString(), col2 + 5, currentY)
          .text(`${prestation.prixUnit.toFixed(2)} €`, col3 + 5, currentY)
          .text(`${(prestation.quantite * prestation.prixUnit).toFixed(2)} €`, col4 + 5, currentY);

        currentY += 30;
      });

      // === Total ===
      currentY += 20;
      doc.fontSize(14).font('Helvetica-Bold');
      doc.rect(col3 - 10, currentY, 152, 30).fillAndStroke('#3b82f6', '#3b82f6');
      doc.fillColor('#ffffff')
        .text('Total HT :', col3, currentY + 8)
        .text(`${facture.totalHT.toFixed(2)} €`, col4, currentY + 8);

      // === Pied de page ===
      doc.fontSize(9).fillColor('#666666').font('Helvetica');
      doc.text('IBAN : FR76 2823 3000 0153 3547 5796 770 | REVOLUT', 50, 700);
      doc.text('Nom/Prénom : VANDEWALLE CLEMENT', 50, 715);
      doc.text('TVA non applicable, article 293B du CGI', 50, 745, { align: 'center' });

      doc.end();
    });
  } catch (error) {
    console.error('Erreur PDF:', error);
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF' }, { status: 500 });
  }
}
