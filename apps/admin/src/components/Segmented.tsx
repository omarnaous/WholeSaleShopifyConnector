import { motion } from "motion/react";
import { clsx } from "clsx";

export interface SegOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Pill tabs with a shared-layout active indicator. */
export function Segmented<T extends string>({ id, label, value, options, onChange }: { id: string; label: string; value: T; options: SegOption<T>[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-8.5 items-center gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "relative inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-md border border-line bg-surface shadow-card"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
                aria-hidden
              />
            )}
            <span className="relative">{o.label}</span>
            {o.count !== undefined && <span className={clsx("relative text-[11.5px] tabular-nums", active ? "text-subtle" : "text-subtle/80")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
