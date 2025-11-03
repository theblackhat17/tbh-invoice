import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// GET /api/clients
// -> liste des clients + nbFactures à plat
export async function GET() {
  const { data, error } = await supabase
    .from("clients")
    .select("*, factures(count)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/clients error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // On ajoute nbFactures = factures[0].count
  const clients = (data ?? []).map((c: any) => ({
    ...c,
    nbFactures: c.factures?.[0]?.count ?? 0,
  }));

  return NextResponse.json(clients);
}

// POST /api/clients
// -> création d’un client + nbFactures (0 au début)
export async function POST(req: Request) {
  const body = await req.json();

  const { data, error } = await supabase
    .from("clients")
    .insert([body])
    .select("*, factures(count)");

  if (error) {
    console.error("POST /api/clients error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const client = data?.[0];
  const clientWithCount = client
    ? { ...client, nbFactures: (client as any).factures?.[0]?.count ?? 0 }
    : null;

  return NextResponse.json(clientWithCount, { status: 201 });
}

// DELETE /api/clients?id=...
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) {
    console.error("DELETE /api/clients error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
