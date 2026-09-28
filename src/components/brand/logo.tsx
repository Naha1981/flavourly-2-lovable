import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: { mark: "h-7 w-7", text: "text-lg", gap: "gap-2" },
    md: { mark: "h-9 w-9", text: "text-xl", gap: "gap-2.5" },
    lg: { mark: "h-12 w-12", text: "text-2xl", gap: "gap-3" },
  } as const;

  const current = sizes[size];

  return (
    <span
      className={cn("inline-flex items-center", current.gap, "shrink-0", className)}
      aria-label="Flavourly"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 44 44"
        className={cn(current.mark, "shrink-0")}
        fill="none"
      >
        <path
          d="M10 7v10M16 7v10M22 7v10"
          stroke="var(--color-forest)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M7 7v10.5c0 3.7 3 6.7 6.7 6.7h4.6c3.7 0 6.7-3 6.7-6.7V7"
          stroke="var(--color-forest)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 24.5V36"
          stroke="var(--color-forest)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M24 34c0-11.4 7.1-20.9 15.5-24.2.3 9.4-4.1 19.8-15.5 24.2Z"
          fill="var(--color-primary)"
        />
        <path
          d="M25 32.8c4.6-3.7 8.7-8.7 11.3-15.8"
          stroke="var(--color-forest)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>

      <span
        className={cn(
          current.text,
          "font-display font-semibold leading-none tracking-[-0.035em] text-foreground",
        )}
      >
        Flavourly
      </span>
    </span>
  );
}
