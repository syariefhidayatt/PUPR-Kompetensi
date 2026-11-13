import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string[] | undefined;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {error?.length ? <p className="text-xs text-red-500">{error[0]}</p> : null}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {pending ? "Memproses…" : children}
    </button>
  );
}
