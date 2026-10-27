import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Glasses } from "lucide-react";

/** Product thumbnail that degrades to a sunglasses outline when the image is missing or 404s. */
export function ProductImage({ src, alt = "", className, iconClassName }: { src: string | null | undefined; alt?: string; className?: string; iconClassName?: string }) {
  const [broken, setBroken] = useState(!src);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setBroken(!src);
    setLoaded(false);
  }, [src]);

  return (
    <div className={clsx("relative overflow-hidden rounded-lg border border-line bg-surface-2", className)}>
      {broken ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-2 to-surface-3/60" role={alt ? "img" : undefined} aria-label={alt || undefined}>
          <Glasses className={clsx("size-1/2 max-h-7 max-w-7 text-subtle/70", iconClassName)} strokeWidth={1.4} aria-hidden />
        </div>
      ) : (
        <img
          src={src ?? undefined}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
          className={clsx("absolute inset-0 size-full object-cover transition-opacity duration-200", loaded ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  );
}
