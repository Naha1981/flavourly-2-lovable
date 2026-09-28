import logoAsset from "@/assets/flavourly-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const heights = { sm: "h-7", md: "h-9", lg: "h-12" } as const;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center overflow-hidden leading-none",
        heights[size],
        className,
      )}
    >
      <img
        src={logoAsset.url}
        alt="Flavourly"
        className={cn(
          "block h-full w-auto max-w-[12rem] object-contain object-left mix-blend-multiply",
          "dark:brightness-125",
        )}
      />
    </span>
  );
}
