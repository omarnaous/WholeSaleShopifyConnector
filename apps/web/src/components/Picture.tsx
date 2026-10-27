import type { CSSProperties } from "react";
import { shotSources } from "../lib/catalog";

/** AVIF → WebP <picture> for rendered product shots, lazy by default. */
export function Picture({
  src,
  alt,
  sizes = "(min-width: 1024px) 33vw, 90vw",
  className,
  imgClassName,
  priority = false,
  style,
}: {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  style?: CSSProperties;
}) {
  const s = shotSources(src);
  if (!s) return <div className={className} style={style} />;
  return (
    <picture className={className} style={style}>
      {"avif" in s && <source type="image/avif" srcSet={s.avif} sizes={sizes} />}
      {"webp" in s && <source type="image/webp" srcSet={s.webp} sizes={sizes} />}
      <img
        src={s.fallback}
        alt={alt}
        width={1200}
        height={900}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className={imgClassName}
        draggable={false}
      />
    </picture>
  );
}
