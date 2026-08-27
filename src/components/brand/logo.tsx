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
    <img
      src={logoAsset.url}
      alt="Flavourly"
      className={cn(heights[size], "w-auto object-contain", className)}
    />
  );
}
