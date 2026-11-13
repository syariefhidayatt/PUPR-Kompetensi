"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavList } from "./nav-list";

/** Menu untuk layar kecil (sidebar desktop disembunyikan di bawah breakpoint md). */
export function MobileNav({ permissions }: { permissions: string[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden print:hidden">
      <button type="button" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(true)} className="rounded-md border border-border p-2 hover:bg-background">
        <Menu className="size-4" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-72 max-w-[85%] overflow-y-auto bg-sidebar px-3 py-4 text-sidebar-foreground">
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="text-sm font-semibold">{process.env.NEXT_PUBLIC_APP_NAME ?? "Sistem Kompetensi & Pelatihan"}</span>
              <button type="button" aria-label="Tutup menu" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/10">
                <X className="size-4" />
              </button>
            </div>
            <NavList permissions={permissions} onNavigate={() => setOpen(false)} />
          </div>
          <button type="button" aria-label="Tutup menu" className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
