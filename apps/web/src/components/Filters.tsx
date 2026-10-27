import { motion } from "motion/react";
import { clsx } from "clsx";

/** Pill group with a shared sliding highlight (layoutId). */
export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  id,
  label: groupLabel,
}: {
  options: { value: T; label: string; dot?: string }[];
  value: T;
  onChange: (v: T) => void;
  id: string;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={groupLabel} className="flex flex-wrap gap-1 rounded-full border hairline p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} role="radio" aria-checked={active} onClick={() => onChange(o.value)} className="relative rounded-full px-4 py-2 text-sm">
            {active && <motion.span layoutId={`pill-${id}`} className="absolute inset-0 rounded-full bg-bone" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className={clsx("relative flex items-center gap-2 transition-colors duration-300", active ? "text-ink" : "text-bone/75 hover:text-bone")}>
              {o.dot && <span className="h-2 w-2 rounded-full" style={{ background: o.dot }} />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select chips (lens tech, gender, frame colour). */
export function Chips<T extends string>({
  options,
  values,
  onToggle,
  label: groupLabel,
}: {
  options: { value: T; label: string; swatch?: string }[];
  values: T[];
  onToggle: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={groupLabel} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <motion.button
            key={o.value}
            aria-pressed={on}
            onClick={() => onToggle(o.value)}
            whileTap={{ scale: 0.94 }}
            className={clsx(
              "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition-colors duration-300",
              on ? "border-bone bg-bone text-ink" : "hairline text-bone/75 hover:border-bone/40 hover:text-bone",
            )}
          >
            {o.swatch && <span className="h-3 w-3 rounded-full ring-1 ring-white/20" style={{ background: o.swatch }} />}
            {o.label}
            <motion.span initial={false} animate={{ width: on ? 10 : 0, opacity: on ? 1 : 0 }} className="overflow-hidden text-[10px]">
              ✕
            </motion.span>
          </motion.button>
        );
      })}
    </div>
  );
}
