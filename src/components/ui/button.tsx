import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "danger";
  size?: "sm" | "md";
};

const VARIANT = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-border bg-transparent hover:bg-background",
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const;

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm",
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}
