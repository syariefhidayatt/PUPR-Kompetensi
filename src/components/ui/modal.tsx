"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Dialog modal memakai elemen <dialog> bawaan browser (fokus-trap & Esc ditangani browser). */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // klik di backdrop
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-lg border border-border bg-card p-0 text-foreground backdrop:bg-black/60",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open ? (
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold">{title}</h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
