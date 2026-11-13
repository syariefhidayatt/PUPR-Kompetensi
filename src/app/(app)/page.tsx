const PHASES = [
  { n: 0, title: "Scaffold & fondasi", status: "Selesai" },
  { n: 1, title: "Auth, RBAC, onboarding", status: "Selesai" },
  { n: 2, title: "Master & Jenis Kompetensi", status: "Selesai" },
  { n: 3, title: "Kompetensi", status: "Selesai" },
  { n: 4, title: "Program Bangkom", status: "Selesai" },
  { n: 5, title: "Pelatihan & cron refresh", status: "Selesai" },
  { n: 6, title: "Matriks Pelatihan", status: "Selesai" },
  { n: 7, title: "Learning Path, usulan, batch & peserta", status: "Selesai" },
  { n: 8, title: "Export, cetak, hardening, migrasi", status: "Berjalan" },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Beranda</h1>
        <p className="mt-1 text-sm text-muted">Modul dibangun bertahap sesuai dokumen teknis.</p>
      </header>
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-medium">Progres fase</h2>
        <ol className="space-y-2">
          {PHASES.map((p) => (
            <li key={p.n} className="flex items-center justify-between text-sm">
              <span>
                Fase {p.n} — {p.title}
              </span>
              <span
                className={
                  p.status === "Selesai"
                    ? "rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground"
                    : "text-xs text-muted"
                }
              >
                {p.status}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
