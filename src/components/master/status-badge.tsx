export function StatusBadge({ aktif }: { aktif: boolean }) {
  return (
    <span
      className={
        aktif
          ? "rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-500"
          : "rounded bg-slate-500/20 px-2 py-0.5 text-xs text-muted"
      }
    >
      {aktif ? "Aktif" : "Nonaktif"}
    </span>
  );
}
