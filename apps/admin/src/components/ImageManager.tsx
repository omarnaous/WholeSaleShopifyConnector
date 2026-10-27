import { useRef, useState, type DragEvent } from "react";
import { Reorder, useDragControls } from "motion/react";
import { clsx } from "clsx";
import { ArrowDown, ArrowUp, GripVertical, ImagePlus, LoaderCircle, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { uploadImage } from "../api";
import { ProductImage } from "./ProductImage";
import { IconButton } from "./ui";

export interface ImageRow {
  key: string;
  url: string;
  alt: string;
  variantSku: string | null;
  /** Local object URL shown while uploading. */
  preview?: string;
  uploading?: boolean;
  progress?: number;
  error?: string;
  file?: File;
}

const ACCEPT = ["image/avif", "image/webp", "image/jpeg", "image/png"];
const MAX = 10 * 1024 * 1024;
let seq = 0;
export const imageKey = () => `img-${Date.now().toString(36)}-${++seq}`;

export function ImageManager({
  images,
  setImages,
  skus,
  errors,
  onAssign,
}: {
  images: ImageRow[];
  setImages: (fn: (xs: ImageRow[]) => ImageRow[]) => void;
  skus: string[];
  errors: Record<string, string>;
  /** Fired when an image is assigned to a SKU, so the variant can adopt it. */
  onAssign?: (sku: string, url: string) => void;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: string, p: Partial<ImageRow>) => setImages((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const start = (row: ImageRow) => {
    if (!row.file) return;
    patch(row.key, { uploading: true, progress: 0, error: undefined });
    uploadImage(row.file, (pct) => patch(row.key, { progress: pct }))
      .then(({ url }) => patch(row.key, { url, uploading: false, progress: 100, file: undefined }))
      .catch((e: Error) => patch(row.key, { uploading: false, error: e.message }));
  };

  const addFiles = (files: FileList | File[]) => {
    const rows: ImageRow[] = [];
    for (const f of Array.from(files)) {
      const row: ImageRow = { key: imageKey(), url: "", alt: "", variantSku: null, preview: URL.createObjectURL(f), file: f };
      if (!ACCEPT.includes(f.type)) row.error = "Use AVIF, WebP, JPEG or PNG";
      else if (f.size > MAX) row.error = "Max 10 MB";
      rows.push(row);
    }
    setImages((xs) => [...xs, ...rows]);
    rows.filter((r) => !r.error).forEach(start);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const move = (i: number, d: -1 | 1) =>
    setImages((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={clsx(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition-colors",
          over ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-2/50",
        )}
      >
        <span className={clsx("flex size-9 items-center justify-center rounded-full", over ? "bg-accent/20 text-accent-ink" : "bg-surface text-subtle shadow-card")}>
          <ImagePlus className="size-4.5" aria-hidden />
        </span>
        <p className="text-[13.5px]">
          <span className="font-medium">Drop product renders here</span> <span className="text-muted">or</span>{" "}
          <button type="button" onClick={() => input.current?.click()} className="font-medium text-accent-ink underline-offset-4 hover:underline">
            browse files
          </button>
        </p>
        <p className="text-[12px] text-subtle">AVIF, WebP, JPEG or PNG · up to 10 MB · first image is the cover</p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT.join(",")}
          multiple
          className="sr-only"
          aria-label="Upload product images"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {images.length > 0 && (
        <Reorder.Group axis="y" values={images} onReorder={(next) => setImages(() => next)} className="flex flex-col gap-2" aria-label="Product images">
          {images.map((img, i) => (
            <ImageItem
              key={img.key}
              img={img}
              index={i}
              count={images.length}
              skus={skus}
              error={errors[`images.${i}.url`] ?? errors[`images.${i}.alt`] ?? errors[`images.${i}.variantSku`]}
              onPatch={(p) => {
                patch(img.key, p);
                if (p.variantSku && img.url) onAssign?.(p.variantSku, img.url);
              }}
              onMove={(d) => move(i, d)}
              onRemove={() => {
                if (img.preview) URL.revokeObjectURL(img.preview);
                setImages((xs) => xs.filter((x) => x.key !== img.key));
              }}
              onRetry={() => start(img)}
            />
          ))}
        </Reorder.Group>
      )}
    </div>
  );
}

function ImageItem({
  img,
  index,
  count,
  skus,
  error,
  onPatch,
  onMove,
  onRemove,
  onRetry,
}: {
  img: ImageRow;
  index: number;
  count: number;
  skus: string[];
  error?: string;
  onPatch: (p: Partial<ImageRow>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const controls = useDragControls();
  const n = index + 1;
  return (
    <Reorder.Item
      value={img}
      dragListener={false}
      dragControls={controls}
      className={clsx("relative flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-2.5 sm:flex-nowrap", img.error || error ? "border-danger/40" : "border-line")}
      whileDrag={{ scale: 1.01, boxShadow: "var(--shadow-lg)" }}
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="hidden cursor-grab touch-none rounded-md p-1 text-subtle hover:text-fg active:cursor-grabbing sm:block"
        aria-label={`Drag to reorder image ${n}`}
        tabIndex={-1}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <div className="relative">
        <ProductImage src={img.url || img.preview} alt="" className="size-16" />
        {index === 0 && !img.error && (
          <span className="absolute -top-1.5 -left-1.5 rounded-md bg-fg px-1.5 py-[1px] text-[10px] font-semibold tracking-wide text-bg uppercase">Cover</span>
        )}
        {img.uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-bg/70">
            <LoaderCircle className="size-4 animate-spin text-fg" aria-hidden />
          </div>
        )}
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div>
          <label htmlFor={`${img.key}-alt`} className="sr-only">
            Alt text for image {n}
          </label>
          <input
            id={`${img.key}-alt`}
            value={img.alt}
            onChange={(e) => onPatch({ alt: e.target.value })}
            placeholder="Alt text — e.g. Riviera in gold with G15 lenses"
            className="field field-sm"
          />
        </div>
        <div>
          <label htmlFor={`${img.key}-sku`} className="sr-only">
            Variant for image {n}
          </label>
          <select id={`${img.key}-sku`} value={img.variantSku ?? ""} onChange={(e) => onPatch({ variantSku: e.target.value || null })} className="field field-sm">
            <option value="">All variants</option>
            {skus.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {img.uploading ? (
          <div className="sm:col-span-2" aria-live="polite">
            <div
              className="h-1 overflow-hidden rounded-full bg-surface-3"
              role="progressbar"
              aria-valuenow={img.progress ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Uploading image ${n}`}
            >
              <div className="h-full origin-left bg-accent transition-transform duration-150" style={{ transform: `scaleX(${(img.progress ?? 0) / 100})` }} />
            </div>
            <p className="mt-1 text-[11.5px] text-subtle">Uploading… {img.progress ?? 0}%</p>
          </div>
        ) : img.error || error ? (
          <p className="flex items-center gap-1.5 text-[12px] text-danger sm:col-span-2">
            <TriangleAlert className="size-3.5" aria-hidden /> {img.error ?? error}
            {img.error && img.file && (
              <button type="button" onClick={onRetry} className="ml-1 inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline">
                <RotateCcw className="size-3" aria-hidden /> Retry
              </button>
            )}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5 sm:flex-col">
        <IconButton label={`Move image ${n} up`} onClick={() => onMove(-1)} disabled={index === 0} className="size-6.5">
          <ArrowUp className="size-3.5" aria-hidden />
        </IconButton>
        <IconButton label={`Move image ${n} down`} onClick={() => onMove(1)} disabled={index === count - 1} className="size-6.5">
          <ArrowDown className="size-3.5" aria-hidden />
        </IconButton>
      </div>
      <IconButton label={`Remove image ${n}`} onClick={onRemove} className="hover:text-danger">
        <Trash2 className="size-3.5" aria-hidden />
      </IconButton>
    </Reorder.Item>
  );
}
