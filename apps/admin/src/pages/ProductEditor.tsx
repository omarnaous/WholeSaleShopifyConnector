import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { Archive, ArrowLeft, Copy, Info, Plus, Store, Trash2, TriangleAlert, Wand2 } from "lucide-react";
import {
  COLLECTIONS,
  FRAME_MATERIALS,
  GENDERS,
  LENS_TYPES,
  STYLES,
  label,
  marginPct,
  slugify,
  type LensType,
  type Product,
  type ProductInput,
} from "@lumen/core";
import { productInput } from "@lumen/core/schemas";
import { FRAME_COLORS, LENS_COLORS } from "@lumen/core/seed";
import { api, ApiError, type AdminProduct, type ApiIssue } from "../api";
import { centsToDollars, dollarsToCents, plural, syncedMsg } from "../lib/format";
import { useToast } from "../components/Toast";
import { useConfirm } from "../components/ConfirmDialog";
import { ColorField } from "../components/ColorField";
import { ImageManager, imageKey, type ImageRow } from "../components/ImageManager";
import { ProductImage } from "../components/ProductImage";
import { ProductStatusBadge } from "../components/badges";
import { Button, ErrorState, IconButton, Skeleton } from "../components/ui";

/* ------------------------------------------------------------------ form model */

interface VRow {
  key: string;
  id?: string;
  sku: string;
  skuTouched: boolean;
  frameColor: string;
  frameColorHex: string;
  lensColor: string;
  lensColorHex: string;
  size: string;
  stock: string;
  cost: string;
  price: string;
  imageUrl: string | null;
}

interface Form {
  name: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  collection: ProductInput["collection"];
  style: ProductInput["style"];
  frameMaterial: ProductInput["frameMaterial"];
  lensTypes: LensType[];
  gender: ProductInput["gender"];
  status: "active" | "archived";
}

let vseq = 0;
const vkey = () => `v-${++vseq}`;
const abbr = (s: string) =>
  s
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();
const suggestSku = (name: string, frame: string, lens: string) => (name && frame && lens ? `LUM-${abbr(name)}-${abbr(frame)}${abbr(lens)}` : "");

const emptyForm = (): Form => ({
  name: "",
  slug: "",
  slugTouched: false,
  description: "",
  collection: "aviator",
  style: "aviator",
  frameMaterial: "metal",
  lensTypes: ["uv400"],
  gender: "unisex",
  status: "active",
});

const newVariant = (name: string, base?: Partial<VRow>): VRow => {
  const r: VRow = {
    key: vkey(),
    sku: "",
    skuTouched: false,
    frameColor: "Black",
    frameColorHex: FRAME_COLORS.Black,
    lensColor: "Smoke",
    lensColorHex: LENS_COLORS.Smoke,
    size: "54",
    stock: "0",
    cost: "",
    price: "",
    imageUrl: null,
    ...base,
  };
  if (!r.skuTouched) r.sku = suggestSku(name, r.frameColor, r.lensColor);
  return r;
};

function fromProduct(p: Product): { form: Form; variants: VRow[]; images: ImageRow[] } {
  const skuById = new Map(p.variants.map((v) => [v.id, v.sku]));
  return {
    form: {
      name: p.name,
      slug: p.slug,
      slugTouched: true,
      description: p.description,
      collection: p.collection,
      style: p.style,
      frameMaterial: p.frameMaterial,
      lensTypes: p.lensTypes,
      gender: p.gender,
      status: p.status,
    },
    variants: p.variants.map((v) => ({
      key: vkey(),
      id: v.id,
      sku: v.sku,
      skuTouched: true,
      frameColor: v.frameColor,
      frameColorHex: v.frameColorHex,
      lensColor: v.lensColor,
      lensColorHex: v.lensColorHex,
      size: v.size,
      stock: String(v.stock),
      cost: centsToDollars(v.wholesaleCost),
      price: centsToDollars(v.suggestedPrice),
      imageUrl: v.imageUrl,
    })),
    images: [...p.images]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ key: imageKey(), url: i.url, alt: i.alt, variantSku: i.variantId ? (skuById.get(i.variantId) ?? null) : null })),
  };
}

const parseStock = (s: string) => (/^\d+$/.test(s.trim()) ? Number.parseInt(s, 10) : Number.NaN);

function buildInput(form: Form, variants: VRow[], images: ImageRow[]) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    description: form.description,
    collection: form.collection,
    style: form.style,
    frameMaterial: form.frameMaterial,
    lensTypes: form.lensTypes,
    gender: form.gender,
    status: form.status,
    variants: variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      sku: v.sku.trim(),
      frameColor: v.frameColor.trim(),
      frameColorHex: v.frameColorHex,
      lensColor: v.lensColor.trim(),
      lensColorHex: v.lensColorHex,
      size: v.size.trim(),
      stock: parseStock(v.stock),
      wholesaleCost: dollarsToCents(v.cost) ?? Number.NaN,
      suggestedPrice: dollarsToCents(v.price) ?? Number.NaN,
      imageUrl: v.imageUrl,
    })),
    images: images.filter((i) => i.url && !i.error).map((i) => ({ url: i.url, alt: i.alt.trim(), variantSku: i.variantSku })),
  };
}

const FRIENDLY: [RegExp, string][] = [
  [/^name$/, "Use at least 2 characters"],
  [/^slug$/, "Lowercase letters, numbers and single dashes"],
  [/^lensTypes$/, "Pick at least one lens type"],
  [/^variants$/, "Add at least one variant"],
  [/^variants\.\d+\.sku$/, "SKU required"],
  [/^variants\.\d+\.frameColor$/, "Name the frame color"],
  [/^variants\.\d+\.lensColor$/, "Name the lens color"],
  [/Hex$/, "Use #RRGGBB"],
  [/^variants\.\d+\.size$/, "Size required"],
  [/^variants\.\d+\.stock$/, "Whole number"],
  [/^variants\.\d+\.(wholesaleCost|suggestedPrice)$/, "Dollar amount"],
];

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  slug: "Slug",
  description: "Description",
  lensTypes: "Lens types",
  variants: "Variants",
  images: "Images",
  sku: "SKU",
  frameColor: "Frame color",
  frameColorHex: "Frame hex",
  lensColor: "Lens color",
  lensColorHex: "Lens hex",
  size: "Size",
  stock: "Stock",
  wholesaleCost: "Wholesale cost",
  suggestedPrice: "Suggested price",
  url: "URL",
  alt: "Alt text",
};

/** "variants.0.wholesaleCost" → "Variant 1 · Wholesale cost" */
function fieldLabel(key: string) {
  const m = key.match(/^(variants|images)\.(\d+)\.(\w+)$/);
  if (m) return `${m[1] === "variants" ? "Variant" : "Image"} ${Number(m[2]) + 1} · ${FIELD_LABELS[m[3]!] ?? m[3]}`;
  return FIELD_LABELS[key] ?? key;
}

function issuesToErrors(issues: ApiIssue[] | { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".");
    if (out[key]) continue;
    out[key] = FRIENDLY.find(([re]) => re.test(key))?.[1] ?? i.message;
  }
  return out;
}

function validate(form: Form, variants: VRow[], images: ImageRow[]) {
  const input = buildInput(form, variants, images);
  const res = productInput.safeParse(input);
  const errors = res.success ? {} : issuesToErrors(res.error.issues);
  // Client-only rules the schema can't express.
  const seen = new Map<string, number>();
  variants.forEach((v, i) => {
    const sku = v.sku.trim().toUpperCase();
    if (!sku) return;
    if (seen.has(sku)) errors[`variants.${i}.sku`] = "Duplicate SKU";
    else seen.set(sku, i);
  });
  if (images.some((i) => i.uploading)) errors["images"] = "Wait for uploads to finish";
  return { input: res.success ? res.data : null, errors };
}

const snapshot = (form: Form, variants: VRow[], images: ImageRow[]) =>
  JSON.stringify({
    f: { ...form, slugTouched: undefined },
    v: variants.map(({ key: _k, skuTouched: _t, ...r }) => r),
    i: images.map((i) => [i.url, i.alt, i.variantSku, i.error ?? null]),
  });

/* ------------------------------------------------------------------ page */

export function ProductEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [loaded, setLoaded] = useState<AdminProduct | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [variants, setVariants] = useState<VRow[]>(() => [newVariant("")]);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [baseline, setBaseline] = useState<string>(() => snapshot(emptyForm(), [], []));
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const hydrate = useCallback((p: AdminProduct) => {
    const s = fromProduct(p);
    setLoaded(p);
    setForm(s.form);
    setVariants(s.variants);
    setImages(s.images);
    setBaseline(snapshot(s.form, s.variants, s.images));
    setAttempted(false);
    setServerErrors({});
  }, []);

  useEffect(() => {
    if (isNew) {
      const f = emptyForm();
      const v = [newVariant("")];
      setLoaded(null);
      setForm(f);
      setVariants(v);
      setImages([]);
      setBaseline(snapshot(f, v, []));
      return;
    }
    let live = true;
    setLoadError(null);
    setLoaded(null);
    api
      .product(id)
      .then((p) => live && hydrate(p))
      .catch((e: Error) => live && setLoadError(e));
    return () => {
      live = false;
    };
  }, [id, isNew, hydrate]);

  const { input, errors: clientErrors } = useMemo(() => validate(form, variants, images), [form, variants, images]);
  const errors = attempted ? { ...serverErrors, ...clientErrors } : {};
  const errorCount = Object.keys(errors).length;
  const dirty = snapshot(form, variants, images) !== baseline;
  const uploading = images.some((i) => i.uploading);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  /* ---- mutations */
  const setF = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const setName = (name: string) => {
    setForm((f) => ({ ...f, name, slug: f.slugTouched ? f.slug : slugify(name) }));
    setVariants((vs) => vs.map((v) => (v.skuTouched ? v : { ...v, sku: suggestSku(name, v.frameColor, v.lensColor) })));
  };

  const patchVariant = (key: string, p: Partial<VRow>) => {
    const v = variants.find((x) => x.key === key);
    if (!v) return;
    const next = { ...v, ...p };
    if (!next.skuTouched && (p.frameColor !== undefined || p.lensColor !== undefined)) next.sku = suggestSku(form.name, next.frameColor, next.lensColor);
    setVariants((vs) => vs.map((x) => (x.key === key ? next : x)));
    // Keep image → SKU links intact when a SKU is renamed.
    const old = v.sku.trim();
    if (old && next.sku.trim() !== old) setImages((xs) => xs.map((i) => (i.variantSku === old ? { ...i, variantSku: next.sku.trim() } : i)));
  };

  const addVariant = () =>
    setVariants((vs) => {
      const last = vs[vs.length - 1];
      return [...vs, newVariant(form.name, last ? { size: last.size, cost: last.cost, price: last.price, frameColor: "", frameColorHex: "#888888", lensColor: "", lensColorHex: "#555555" } : undefined)];
    });

  const duplicateVariant = (key: string) =>
    setVariants((vs) => {
      const i = vs.findIndex((v) => v.key === key);
      const src = vs[i];
      if (!src) return vs;
      const taken = new Set(vs.map((v) => v.sku));
      let sku = `${src.sku}-2`;
      for (let n = 3; taken.has(sku); n++) sku = `${src.sku}-${n}`;
      const copy: VRow = { ...src, key: vkey(), id: undefined, sku, skuTouched: true, stock: "0" };
      return [...vs.slice(0, i + 1), copy, ...vs.slice(i + 1)];
    });

  const removeVariant = (key: string) => setVariants((vs) => vs.filter((v) => v.key !== key));

  const fillSkus = () => setVariants((vs) => vs.map((v) => (v.sku.trim() ? v : { ...v, sku: suggestSku(form.name || "LUM", v.frameColor, v.lensColor), skuTouched: false })));

  /* ---- save */
  async function save() {
    setAttempted(true);
    setServerErrors({});
    if (!input || Object.keys(clientErrors).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const p = await api.createProduct(input);
        setBaseline(snapshot(form, variants, images)); // allow navigation without the dirty guard
        toast.success(`${p.name} created`, "It's live in the catalog for subscriber stores.");
        navigate(`/products/${p.id}`, { replace: true });
      } else {
        const res = await api.updateProduct(id, input);
        hydrate({ ...res.product, importedBy: loaded?.importedBy });
        toast.success(`Saved · ${syncedMsg(res.syncJobsQueued)}`, res.syncJobsQueued ? "Stock and cost changes are on their way." : undefined);
      }
    } catch (e) {
      if (e instanceof ApiError && e.issues?.length) {
        setServerErrors(issuesToErrors(e.issues));
        requestAnimationFrame(() => summaryRef.current?.focus());
      }
      toast.error("Couldn't save product", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // ⌘S / Ctrl+S
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function archive() {
    if (!loaded) return;
    const ok = await confirm({
      title: `Archive ${loaded.name}?`,
      body: "It's removed from the catalog for new imports. Stores that already imported it keep their copy.",
      confirmLabel: "Archive product",
    });
    if (!ok) return;
    try {
      await api.archiveProduct(loaded.id);
      toast.success(`${loaded.name} archived`);
      const p = await api.product(loaded.id);
      hydrate(p);
    } catch (e) {
      toast.error("Couldn't archive", (e as Error).message);
    }
  }

  async function discard() {
    if (!(await confirm({ title: "Discard unsaved changes?", confirmLabel: "Discard" }))) return;
    if (loaded) hydrate(loaded);
    else {
      const f = emptyForm();
      const v = [newVariant("")];
      setForm(f);
      setVariants(v);
      setImages([]);
      setBaseline(snapshot(f, v, []));
      setAttempted(false);
    }
  }

  /* ---- render */
  if (loadError)
    return (
      <>
        <BackLink />
        <ErrorState error={loadError} />
      </>
    );
  if (!isNew && !loaded) return <EditorSkeleton />;

  const skus = variants.map((v) => v.sku.trim()).filter(Boolean);
  const imageOptions = images.filter((i) => i.url && !i.error);
  const err = (k: string) => errors[k];

  return (
    <div className="pb-24">
      <BackLink />
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ProductImage src={imageOptions[0]?.url ?? variants.find((v) => v.imageUrl)?.imageUrl} className="size-14 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[12.5px] text-subtle">
              {isNew ? "New product" : <ProductStatusBadge status={loaded!.status} />}
              {!isNew && <span className="font-mono">{loaded!.id}</span>}
            </div>
            <h1 className="truncate font-serif text-[34px] leading-[1.05] sm:text-[40px]">{form.name.trim() || (isNew ? "Untitled frame" : loaded!.name)}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && loaded!.status === "active" && (
            <Button icon={<Archive className="size-3.5" aria-hidden />} onClick={archive}>
              Archive
            </Button>
          )}
          <Button variant="primary" onClick={save} loading={saving} disabled={uploading}>
            {isNew ? "Create product" : "Save changes"}
          </Button>
        </div>
      </header>

      {!isNew && <SyncNotice count={loaded!.importedBy ?? 0} />}

      <AnimatePresence>
        {attempted && errorCount > 0 && (
          <motion.div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card mb-5 flex items-start gap-3 border-danger/30 bg-danger-soft p-3.5 text-[13.5px]"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            <div>
              <p className="font-medium text-danger">Fix {plural(errorCount, "field")} before saving</p>
              <ul className="mt-1 list-disc pl-4 text-[12.5px] text-muted">
                {Object.entries(errors)
                  .slice(0, 6)
                  .map(([k, m]) => (
                    <li key={k}>
                      <span className="font-medium text-fg">{fieldLabel(k)}</span> — {m}
                    </li>
                  ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Section title="Details" description="Title and description are copied to a store on import; after that, the store owns them.">
          <div className="grid gap-4">
            <Field id="name" label="Name" error={err("name")}>
              <input id="name" value={form.name} onChange={(e) => setName(e.target.value)} className="field" aria-invalid={!!err("name")} aria-describedby={err("name") ? "name-error" : undefined} placeholder="e.g. Riviera" autoFocus={isNew} />
            </Field>
            <Field id="slug" label="Slug" error={err("slug")} hint={!form.slugTouched ? "Generated from the name" : undefined}>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-lg border border-r-0 border-line-strong bg-surface-2 px-2.5 text-[12.5px] text-subtle">/products/</span>
                <input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-"), slugTouched: e.target.value !== "" }))}
                  onBlur={() => !form.slug && setForm((f) => ({ ...f, slug: slugify(f.name), slugTouched: false }))}
                  className="field rounded-l-none font-mono text-[13px]"
                  aria-invalid={!!err("slug")}
                  aria-describedby={err("slug") ? "slug-error" : "slug-hint"}
                />
              </div>
            </Field>
            <Field id="description" label="Description" error={err("description")} hint={`${form.description.length} / 4000`}>
              <textarea
                id="description"
                rows={5}
                value={form.description}
                onChange={(e) => setF("description", e.target.value)}
                className="field leading-relaxed"
                aria-invalid={!!err("description")}
                placeholder="Materials, fit, the story behind the frame…"
              />
            </Field>
          </div>
        </Section>

        <Section title="Organization">
          <div className="grid gap-4">
            <Field id="status" label="Status">
              <select id="status" value={form.status} onChange={(e) => setF("status", e.target.value as Form["status"])} className="field">
                <option value="active">Active — in catalog</option>
                <option value="archived">Archived — hidden</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <SelectField id="collection" label="Collection" value={form.collection} options={COLLECTIONS} onChange={(v) => setF("collection", v)} />
              <SelectField id="style" label="Style" value={form.style} options={STYLES} onChange={(v) => setF("style", v)} />
              <SelectField id="frameMaterial" label="Frame material" value={form.frameMaterial} options={FRAME_MATERIALS} onChange={(v) => setF("frameMaterial", v)} />
              <SelectField id="gender" label="Gender" value={form.gender} options={GENDERS} onChange={(v) => setF("gender", v)} />
            </div>
            <fieldset aria-describedby={err("lensTypes") ? "lensTypes-error" : undefined}>
              <legend className="label">Lens types</legend>
              <div className="flex flex-wrap gap-1.5">
                {LENS_TYPES.map((l) => {
                  const on = form.lensTypes.includes(l);
                  return (
                    <label
                      key={l}
                      className={clsx(
                        "inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                        on ? "border-accent/50 bg-accent-soft text-accent-ink" : "border-line-strong bg-surface text-muted hover:text-fg",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() => setF("lensTypes", on ? form.lensTypes.filter((x) => x !== l) : LENS_TYPES.filter((x) => x === l || form.lensTypes.includes(x)))}
                      />
                      {label(l)}
                    </label>
                  );
                })}
              </div>
              {err("lensTypes") && (
                <p id="lensTypes-error" className="mt-1.5 text-[12px] text-danger">
                  {err("lensTypes")}
                </p>
              )}
            </fieldset>
          </div>
        </Section>
      </div>

      <Section
        className="mt-6"
        title="Variants"
        description={`${plural(variants.length, "variant")} · stock and wholesale cost keep syncing to stores after import; suggested price is only a starting point.`}
        actions={
          <>
            <Button size="sm" variant="ghost" icon={<Wand2 className="size-3.5" aria-hidden />} onClick={fillSkus}>
              Fill empty SKUs
            </Button>
            <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={addVariant} disabled={variants.length >= 100}>
              Add variant
            </Button>
          </>
        }
        flush
      >
        {err("variants") && <p className="px-4 pt-3 text-[12.5px] text-danger">{err("variants")}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] border-separate border-spacing-0 text-[13px]">
            <caption className="sr-only">Variants</caption>
            <thead>
              <tr>
                <th className="th pl-4" scope="col">
                  SKU
                </th>
                <th className="th" scope="col">
                  Frame color
                </th>
                <th className="th" scope="col">
                  Lens color
                </th>
                <th className="th" scope="col">
                  Size
                </th>
                <th className="th text-right" scope="col">
                  Stock
                </th>
                <th className="th text-right" scope="col">
                  Cost
                </th>
                <th className="th text-right" scope="col">
                  Suggested
                </th>
                <th className="th text-right" scope="col">
                  Margin
                </th>
                <th className="th" scope="col">
                  Image
                </th>
                <th className="th pr-4" scope="col">
                  <span className="sr-only">Row actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <VariantRow
                  key={v.key}
                  v={v}
                  i={i}
                  errors={errors}
                  imageOptions={imageOptions}
                  onPatch={(p) => patchVariant(v.key, p)}
                  onDuplicate={() => duplicateVariant(v.key)}
                  onRemove={() => removeVariant(v.key)}
                  canRemove={variants.length > 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section className="mt-6" title="Images" description="Drag to reorder — the first image is the cover. Assign an image to a SKU to show it when that variant is selected.">
        {err("images") && <p className="mb-2 text-[12.5px] text-danger">{err("images")}</p>}
        <ImageManager
          images={images}
          setImages={setImages}
          skus={skus}
          errors={errors}
          onAssign={(sku, url) => setVariants((vs) => vs.map((v) => (v.sku.trim() === sku && !v.imageUrl ? { ...v, imageUrl: url } : v)))}
        />
      </Section>

      {/* Sticky save bar */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 lg:pl-[236px]"
          >
            <div className="flex w-full max-w-[560px] items-center gap-3 rounded-xl border border-line bg-surface/95 py-2 pr-2 pl-4 shadow-pop backdrop-blur">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
              <p className="flex-1 text-[13px] font-medium">
                Unsaved changes
                <span className="ml-2 hidden text-[12px] font-normal text-subtle sm:inline">
                  <span className="kbd">⌘</span> <span className="kbd">S</span> to save
                </span>
              </p>
              <Button size="sm" variant="ghost" onClick={discard} disabled={saving}>
                Discard
              </Button>
              <Button size="sm" variant="primary" onClick={save} loading={saving} disabled={uploading}>
                {uploading ? "Uploading…" : isNew ? "Create product" : "Save"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function BackLink() {
  return (
    <Link to="/products" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-fg">
      <ArrowLeft className="size-3.5" aria-hidden /> Products
    </Link>
  );
}

function SyncNotice({ count }: { count: number }) {
  return (
    <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <span className={clsx("flex size-9 shrink-0 items-center justify-center rounded-full", count ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-subtle")}>
          <Store className="size-4" aria-hidden />
        </span>
        <p className="text-[14px] font-medium">{count > 0 ? `${plural(count, "store")} imported this product` : "No store has imported this product yet"}</p>
      </div>
      <p className="flex items-start gap-1.5 text-[12.5px] text-muted sm:ml-auto sm:max-w-[520px]">
        <Info className="mt-[2px] size-3.5 shrink-0 text-subtle" aria-hidden />
        <span>
          After import, only <strong className="font-medium text-fg">stock</strong> and <strong className="font-medium text-fg">wholesale cost</strong> propagate to stores. Title,
          description, images and price stay as each store set them.
        </span>
      </p>
    </div>
  );
}

function Section({
  title,
  description,
  actions,
  children,
  className,
  flush,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={clsx("card", flush ? "overflow-visible" : "", className)} aria-labelledby={`sec-${title}`}>
      <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id={`sec-${title}`} className="text-[14px] font-semibold">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

function Field({ id, label: text, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="label">
          {text}
        </label>
        {hint && !error && (
          <span id={`${id}-hint`} className="text-[11.5px] text-subtle">
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function SelectField<T extends string>({ id, label: text, value, options, onChange }: { id: string; label: string; value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {text}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className="field">
        {options.map((o) => (
          <option key={o} value={o}>
            {label(o)}
          </option>
        ))}
      </select>
    </div>
  );
}

function CellError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-[11.5px] whitespace-nowrap text-danger">{msg}</p> : null;
}

function VariantRow({
  v,
  i,
  errors,
  imageOptions,
  onPatch,
  onDuplicate,
  onRemove,
  canRemove,
}: {
  v: VRow;
  i: number;
  errors: Record<string, string>;
  imageOptions: ImageRow[];
  onPatch: (p: Partial<VRow>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const e = (f: string) => errors[`variants.${i}.${f}`];
  const n = i + 1;
  const cost = dollarsToCents(v.cost);
  const price = dollarsToCents(v.price);
  const m = cost !== null && price !== null && price > 0 ? marginPct(cost, price) : null;
  const imgIndex = imageOptions.findIndex((x) => x.url === v.imageUrl);
  const td = "border-b border-line px-1.5 py-2.5 align-top";

  return (
    <tr className="[&:last-child>td]:border-b-0">
      <td className={clsx(td, "pl-4")}>
        <input
          value={v.sku}
          onChange={(ev) => onPatch({ sku: ev.target.value.toUpperCase(), skuTouched: true })}
          aria-label={`Variant ${n} SKU`}
          aria-invalid={!!e("sku")}
          className="field field-sm w-[128px] font-mono text-[12px]"
          placeholder="LUM-XXX-XXXXXX"
        />
        <CellError msg={e("sku")} />
      </td>
      <td className={clsx(td, "w-[164px] min-w-[156px]")}>
        <ColorField
          idBase={`v${v.key}-frame`}
          kind="Frame"
          name={v.frameColor}
          hex={v.frameColorHex}
          presets={FRAME_COLORS}
          onChange={({ name, hex }) => onPatch({ ...(name !== undefined && { frameColor: name }), ...(hex !== undefined && { frameColorHex: hex }) })}
          nameError={e("frameColor")}
          hexError={e("frameColorHex")}
        />
      </td>
      <td className={clsx(td, "w-[164px] min-w-[156px]")}>
        <ColorField
          idBase={`v${v.key}-lens`}
          kind="Lens"
          name={v.lensColor}
          hex={v.lensColorHex}
          presets={LENS_COLORS}
          onChange={({ name, hex }) => onPatch({ ...(name !== undefined && { lensColor: name }), ...(hex !== undefined && { lensColorHex: hex }) })}
          nameError={e("lensColor")}
          hexError={e("lensColorHex")}
        />
      </td>
      <td className={td}>
        <input value={v.size} onChange={(ev) => onPatch({ size: ev.target.value })} aria-label={`Variant ${n} size`} aria-invalid={!!e("size")} className="field field-sm w-[52px]" placeholder="54" />
        <CellError msg={e("size")} />
      </td>
      <td className={td}>
        <input
          value={v.stock}
          inputMode="numeric"
          onChange={(ev) => onPatch({ stock: ev.target.value })}
          aria-label={`Variant ${n} stock`}
          aria-invalid={!!e("stock")}
          className="field field-sm ml-auto block w-16 text-right tabular-nums"
        />
        <CellError msg={e("stock")} />
      </td>
      <td className={td}>
        <MoneyInput value={v.cost} onChange={(cost) => onPatch({ cost })} label={`Variant ${n} wholesale cost in dollars`} invalid={!!e("wholesaleCost")} />
        <CellError msg={e("wholesaleCost")} />
      </td>
      <td className={td}>
        <MoneyInput value={v.price} onChange={(price) => onPatch({ price })} label={`Variant ${n} suggested price in dollars`} invalid={!!e("suggestedPrice")} />
        <CellError msg={e("suggestedPrice")} />
      </td>
      <td className={clsx(td, "pt-[15px] text-right font-medium tabular-nums")} aria-live="polite">
        {m === null ? (
          <span className="text-subtle">—</span>
        ) : (
          <span className={m < 30 ? "text-danger" : m < 55 ? "text-warn" : "text-success"}>{m.toFixed(1)}%</span>
        )}
      </td>
      <td className={td}>
        <div className="flex items-center gap-1.5">
          <ProductImage src={v.imageUrl} className="size-[28px] shrink-0 rounded-md" />
          <select
            value={imgIndex >= 0 ? String(imgIndex) : v.imageUrl ? "keep" : ""}
            onChange={(ev) => {
              const val = ev.target.value;
              if (val === "keep") return;
              onPatch({ imageUrl: val === "" ? null : (imageOptions[Number(val)]?.url ?? null) });
            }}
            aria-label={`Variant ${n} image`}
            className="field field-sm w-[88px]"
          >
            <option value="">None</option>
            {v.imageUrl && imgIndex < 0 && <option value="keep">Current</option>}
            {imageOptions.map((img, k) => (
              <option key={img.key} value={String(k)}>
                Image {k + 1}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className={clsx(td, "pr-4")}>
        <div className="flex items-center justify-end gap-0.5">
          <IconButton label={`Duplicate variant ${n}`} onClick={onDuplicate}>
            <Copy className="size-3.5" aria-hidden />
          </IconButton>
          <IconButton label={`Remove variant ${n}`} onClick={onRemove} disabled={!canRemove} className="hover:text-danger">
            <Trash2 className="size-3.5" aria-hidden />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

function MoneyInput({ value, onChange, label: text, invalid }: { value: string; onChange: (v: string) => void; label: string; invalid: boolean }) {
  return (
    <div className="relative ml-auto w-[84px]">
      <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[12.5px] text-subtle" aria-hidden>
        $
      </span>
      <input
        value={value}
        inputMode="decimal"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const c = dollarsToCents(value);
          if (c !== null) onChange(centsToDollars(c));
        }}
        aria-label={text}
        aria-invalid={invalid}
        placeholder="0.00"
        className="field field-sm pl-5 text-right tabular-nums"
      />
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div>
      <Skeleton className="mb-5 h-4 w-20" />
      <div className="mb-6 flex items-center gap-4">
        <Skeleton className="size-14 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-56" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
      <Skeleton className="mt-6 h-[220px] rounded-xl" />
    </div>
  );
}
