import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { Check, Palette } from "lucide-react";

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Color name + hex, with a native color input and a preset palette popover.
 * Typing a preset's exact name also snaps the hex.
 */
export function ColorField({
  idBase,
  kind,
  name,
  hex,
  presets,
  onChange,
  nameError,
  hexError,
}: {
  idBase: string;
  kind: "Frame" | "Lens";
  name: string;
  hex: string;
  presets: Record<string, string>;
  onChange: (v: { name?: string; hex?: string }) => void;
  nameError?: string;
  hexError?: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = pos !== null;
  const setOpen = (o: boolean | ((o: boolean) => boolean)) => {
    const next = typeof o === "function" ? o(open) : o;
    if (!next) return setPos(null);
    // Fixed positioning so the popover escapes the variants table's scroll container.
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    const width = 236;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const below = r.bottom + 6;
    const top = below + 260 > window.innerHeight ? Math.max(8, r.top - 6 - 252) : below;
    setPos({ top, left });
  };
  const wrap = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        wrap.current?.querySelector<HTMLButtonElement>("[data-preset-toggle]")?.focus();
      }
    };
    const onScroll = (e: Event) => {
      if (!(e.target instanceof Node && wrap.current?.contains(e.target))) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const err = nameError ?? hexError;
  const safeHex = HEX.test(hex) ? hex : "#000000";

  return (
    <div ref={wrap} className="relative">
      <div
        className={clsx(
          "flex h-[30px] items-center rounded-[7px] border bg-surface transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_22%,transparent)]",
          err ? "border-danger" : "border-line-strong",
        )}
      >
        <label className="relative ml-1 flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] ring-1 ring-black/10 ring-inset" style={{ background: safeHex }}>
          <span className="sr-only">{kind} color hex</span>
          <input
            id={`${idBase}-hex`}
            type="color"
            value={safeHex}
            onChange={(e) => onChange({ hex: e.target.value })}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-invalid={!!hexError}
          />
        </label>
        <input
          id={`${idBase}-name`}
          value={name}
          onChange={(e) => {
            const v = e.target.value;
            const match = Object.entries(presets).find(([k]) => k.toLowerCase() === v.trim().toLowerCase());
            onChange(match ? { name: v, hex: match[1] } : { name: v });
          }}
          placeholder={`${kind} color`}
          aria-label={`${kind} color name`}
          aria-invalid={!!nameError}
          className="h-full w-full min-w-0 bg-transparent px-2 text-[13px] outline-none placeholder:text-subtle"
        />
        <button
          type="button"
          data-preset-toggle
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={popId}
          aria-label={`${kind} color presets`}
          title="Presets"
          className="mr-0.5 flex size-6 shrink-0 items-center justify-center rounded-[5px] text-subtle hover:bg-surface-2 hover:text-fg"
        >
          <Palette className="size-3.5" aria-hidden />
        </button>
      </div>
      <AnimatePresence>
        {pos && (
          <motion.div
            id={popId}
            role="group"
            aria-label={`${kind} color presets`}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-40 w-[236px] rounded-xl border border-line bg-surface p-2 shadow-pop"
          >
            <div className="grid grid-cols-2 gap-0.5">
              {Object.entries(presets).map(([n, h]) => {
                const active = n === name && h.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      onChange({ name: n, hex: h });
                      setOpen(false);
                    }}
                    className={clsx("flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] hover:bg-surface-2", active && "bg-surface-2")}
                  >
                    <span className="size-3.5 shrink-0 rounded-full ring-1 ring-black/10 ring-inset" style={{ background: h }} aria-hidden />
                    <span className="truncate">{n}</span>
                    {active && <Check className="ml-auto size-3 text-accent-ink" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {err && <p className="mt-1 text-[11.5px] text-danger">{err}</p>}
    </div>
  );
}
