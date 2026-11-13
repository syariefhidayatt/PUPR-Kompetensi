import { logoutAction } from "@/server/auth/actions";
import { MobileNav } from "./mobile-nav";

export function Topbar({ name, roles, permissions }: { name?: string | null; roles: string[]; permissions: string[] }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 text-sm md:justify-end md:px-6 print:hidden">
      <MobileNav permissions={permissions} />
      <div className="flex items-center gap-4">
        <div className="text-right leading-tight">
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted">{roles.join(", ")}</div>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="rounded-md border border-border px-3 py-1.5 hover:bg-background">
            Keluar
          </button>
        </form>
      </div>
    </div>
  );
}
