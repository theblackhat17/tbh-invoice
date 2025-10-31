import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// Génère un numéro type 2025-10-001 en regardant les factures existantes
async function genererNumeroFacture(): Promise<string> {
  const now = new Date();
  const annee = now.getFullYear();
  const mois = String(now.getMonth() + 1).padStart(2, '0');
  const prefixe = `${annee}-${mois}`;

  const { data, error } = await supabase
    .from('factures')
    .select('numero')
    .ilike('numero', `${prefixe}-%`);

  if (error) throw new Error(error.message);

  const seq = (data ?? [])
    .map((f) => parseInt(String(f.numero).split('-')[2] || '0', 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)[0] || 0;

  const next = String(seq + 1).padStart(3, '0');
  return `${prefixe}-${next}`;
}

// ===== GET: liste des factures (forme attendue par ton front) =====
export async function GET() {
  const { data, error } = await supabase
    .from('factures')
    .select(`
      id,
      numero,
      date,
      type_document,
      total_ht,
      client:clients!factures_client_id_fkey ( nom )
    `)
    .order('date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Adapter les champs pour ton front (typeDocument, totalHT, client.nom)
  const shaped = (data ?? []).map((f: any) => ({
    id: f.id,
    numero: f.numero,
    date: f.date,
    typeDocument: f.type_document,
    totalHT: Number(f.total_ht ?? 0),
    client: { nom: f.client?.nom ?? '—' },
  }));

  return NextResponse.json(shaped);
}

// ===== POST: création facture + lignes de prestations =====
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { typeDocument, date, clientId, prestations = [], totalHT } = body;

    if (!clientId) return NextResponse.json({ error: 'clientId manquant' }, { status: 400 });
    if (!typeDocument) return NextResponse.json({ error: 'typeDocument manquant' }, { status: 400 });
    if (!date) return NextResponse.json({ error: 'date manquante' }, { status: 400 });

    // Clamp des valeurs
    const safePrestations = (prestations as any[]).map((p) => ({
      description: String(p.description ?? '').trim(),
      quantite: Number.isFinite(p.quantite) && p.quantite >= 0 ? p.quantite : 0,
      prix_unit: Number.isFinite(p.prixUnit) && p.prixUnit >= 0 ? p.prixUnit : 0,
    }));

    const safeTotal =
      safePrestations.reduce((t, p) => t + p.quantite * p.prix_unit, 0);

    // Générer le numéro ici ✅
    const numero = await genererNumeroFacture();

    // 1) Insert facture
    const { data: newFactureArr, error: errInsert } = await supabase
      .from('factures')
      .insert([
        {
          numero,
          date, // format 'YYYY-MM-DD' ok
          type_document: typeDocument,
          total_ht: safeTotal, // on recalcule côté serveur
          client_id: clientId,
        },
      ])
      .select()
      .single();

    if (errInsert) {
      return NextResponse.json({ error: errInsert.message }, { status: 500 });
    }

    const newFacture = newFactureArr;

    // 2) Insert prestations (si présentes)
    if (safePrestations.length > 0) {
      const lignes = safePrestations.map((p) => ({
        ...p,
        facture_id: newFacture.id,
      }));
      const { error: errLignes } = await supabase.from('prestations').insert(lignes);
      if (errLignes) {
        return NextResponse.json({ error: errLignes.message }, { status: 500 });
      }
    }

    // Réponse au front (forme attendue)
    return NextResponse.json({
      id: newFacture.id,
      numero: newFacture.numero,
      date: newFacture.date,
      typeDocument: newFacture.type_document,
      totalHT: Number(newFacture.total_ht ?? 0),
      clientId: newFacture.client_id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
