import { useEffect, useRef, useState } from "react";
import logoAsset from "@/assets/flavourly-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth === 0) setFailed(true);
  }, []);
  const heights = { sm: "h-7", md: "h-9", lg: "h-12" } as const;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center overflow-hidden leading-none",
        heights[size],
        className,
      )}
    >
      {failed ? (
        <span className="font-serif text-2xl font-semibold tracking-tight text-foreground">
          Flavourly
        </span>
      ) : (
        <img
          ref={image}
          src={logoAsset.url}
          onError={() => setFailed(true)}
          alt="Flavourly"
          className={cn(
            "block h-full w-auto max-w-[12rem] object-contain object-left mix-blend-multiply",
            "dark:brightness-125",
          )}
        />
      )}
    </span>
  );
}
