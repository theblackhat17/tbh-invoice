import Link from "next/link";

export default function Home() {
  return (
    <div className="py-10">
      <section className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          Tableau de Bord
        </h1>
        <p className="mt-3 text-zinc-500">
          Gérez vos factures et vos clients en un clin d’œil.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/factures" className="group">
          <div className="card h-48 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-sky-500/20" />
            <div className="relative h-full flex flex-col items-center justify-center">
              <div className="text-6xl mb-3 floating">📄</div>
              <h2 className="text-2xl font-bold">Factures</h2>
              <p className="mt-1 text-zinc-500 group-hover:text-zinc-400 transition-colors">
                Créez, exportez, supprimez
              </p>
            </div>
          </div>
        </Link>

        <Link href="/clients" className="group">
          <div className="card h-48 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20" />
            <div className="relative h-full flex flex-col items-center justify-center">
              <div className="text-6xl mb-3 floating">👥</div>
              <h2 className="text-2xl font-bold">Clients</h2>
              <p className="mt-1 text-zinc-500 group-hover:text-zinc-400 transition-colors">
                Fiches et coordonnées
              </p>
            </div>
          </div>
        </Link>

        <Link href="/factures/nouvelle">
          <div className="card h-48 flex flex-col items-center justify-center">
            <div className="text-6xl mb-3">➕</div>
            <h2 className="text-2xl font-bold">Nouvelle facture</h2>
            <p className="mt-1 text-zinc-500">Numéro auto & PDF</p>
          </div>
        </Link>

        <Link href="/clients/nouveau">
          <div className="card h-48 flex flex-col items-center justify-center">
            <div className="text-6xl mb-3">➕</div>
            <h2 className="text-2xl font-bold">Nouveau client</h2>
            <p className="mt-1 text-zinc-500">Ajoutez une fiche client</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
