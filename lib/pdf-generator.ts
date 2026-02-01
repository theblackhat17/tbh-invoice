import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface FactureData {
  numero: string;
  date: string;
  typeDocument: string;
  clientNom: string;
  clientAdresse: string;
  clientEmail?: string;
  clientTelephone?: string;
  clientSiret?: string;
  prestations: Array<{
    description: string;
    quantite: number;
    prixUnit: number;
  }>;
  totalHT: number;
}

interface EntrepriseData {
  nom: string;
  adresse: string;
  code_postal?: string;
  ville?: string;
  telephone?: string;
  email?: string;
  siret?: string;
  tva_intra?: string;
}

export async function generateFacturePDF(
  facture: FactureData,
  entreprise: EntrepriseData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  let yPosition = height - 50;

  // Titre
  page.drawText(`${facture.typeDocument.toUpperCase()} N° ${facture.numero}`, {
    x: 50,
    y: yPosition,
    size: 20,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  yPosition -= 40;

  // Informations entreprise (gauche)
  page.drawText(entreprise.nom, {
    x: 50,
    y: yPosition,
    size: 12,
    font: fontBold,
  });
  yPosition -= 15;
  page.drawText(entreprise.adresse, { x: 50, y: yPosition, size: 10, font });
  yPosition -= 12;
  if (entreprise.code_postal && entreprise.ville) {
    page.drawText(`${entreprise.code_postal} ${entreprise.ville}`, {
      x: 50,
      y: yPosition,
      size: 10,
      font,
    });
    yPosition -= 12;
  }
  if (entreprise.telephone) {
    page.drawText(`Tél: ${entreprise.telephone}`, { x: 50, y: yPosition, size: 10, font });
    yPosition -= 12;
  }
  if (entreprise.email) {
    page.drawText(`Email: ${entreprise.email}`, { x: 50, y: yPosition, size: 10, font });
    yPosition -= 12;
  }
  if (entreprise.siret) {
    page.drawText(`SIRET: ${entreprise.siret}`, { x: 50, y: yPosition, size: 10, font });
    yPosition -= 12;
  }

  // Informations client (droite)
  yPosition = height - 90;
  page.drawText('CLIENT', {
    x: 350,
    y: yPosition,
    size: 12,
    font: fontBold,
  });
  yPosition -= 15;
  page.drawText(facture.clientNom, { x: 350, y: yPosition, size: 10, font: fontBold });
  yPosition -= 12;
  page.drawText(facture.clientAdresse, { x: 350, y: yPosition, size: 10, font });
  yPosition -= 12;
  if (facture.clientTelephone) {
    page.drawText(facture.clientTelephone, { x: 350, y: yPosition, size: 10, font });
    yPosition -= 12;
  }
  if (facture.clientEmail) {
    page.drawText(facture.clientEmail, { x: 350, y: yPosition, size: 10, font });
    yPosition -= 12;
  }
  if (facture.clientSiret) {
    page.drawText(`SIRET: ${facture.clientSiret}`, { x: 350, y: yPosition, size: 10, font });
  }

  // Date facture
  yPosition = height - 250;
  page.drawText(`Date: ${new Date(facture.date).toLocaleDateString('fr-FR')}`, {
    x: 50,
    y: yPosition,
    size: 10,
    font,
  });

  yPosition -= 40;

  // En-tête tableau
  page.drawRectangle({
    x: 50,
    y: yPosition - 15,
    width: width - 100,
    height: 20,
    color: rgb(0.9, 0.9, 0.9),
  });

  page.drawText('Description', { x: 55, y: yPosition - 10, size: 10, font: fontBold });
  page.drawText('Qté', { x: 350, y: yPosition - 10, size: 10, font: fontBold });
  page.drawText('P.U. HT', { x: 400, y: yPosition - 10, size: 10, font: fontBold });
  page.drawText('Total HT', { x: 480, y: yPosition - 10, size: 10, font: fontBold });

  yPosition -= 25;

  // Lignes prestations
  for (const presta of facture.prestations) {
    const total = presta.quantite * presta.prixUnit;

    page.drawText(presta.description.substring(0, 50), {
      x: 55,
      y: yPosition,
      size: 9,
      font,
    });
    page.drawText(presta.quantite.toString(), { x: 355, y: yPosition, size: 9, font });
    page.drawText(`${presta.prixUnit.toFixed(2)} €`, { x: 400, y: yPosition, size: 9, font });
    page.drawText(`${total.toFixed(2)} €`, { x: 475, y: yPosition, size: 9, font });

    yPosition -= 15;

    if (yPosition < 100) {
      // Nouvelle page si nécessaire
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = newPage.getHeight() - 50;
    }
  }

  // Total
  yPosition -= 20;
  page.drawRectangle({
    x: 400,
    y: yPosition - 15,
    width: 145,
    height: 25,
    color: rgb(0.95, 0.95, 0.95),
  });

  page.drawText('TOTAL HT', {
    x: 410,
    y: yPosition - 8,
    size: 12,
    font: fontBold,
  });
  page.drawText(`${facture.totalHT.toFixed(2)} €`, {
    x: 480,
    y: yPosition - 8,
    size: 12,
    font: fontBold,
  });

  // Footer
  page.drawText('Conditions de paiement : À réception de facture', {
    x: 50,
    y: 50,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return await pdfDoc.save();
}
