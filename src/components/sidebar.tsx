import { NavList } from "./nav-list";

export function Sidebar({ permissions }: { permissions: string[] }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex print:hidden">
      <div className="shrink-0 px-5 py-5 text-sm font-semibold leading-tight">
        {process.env.NEXT_PUBLIC_APP_NAME ?? "Sistem Kompetensi & Pelatihan"}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6">
        <NavList permissions={permissions} />
      </div>
    </aside>
  );
}
