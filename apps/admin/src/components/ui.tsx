import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { clsx } from "clsx";
import { LoaderCircle, TriangleAlert } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:bg-fg/88 border border-transparent shadow-card",
  accent: "bg-accent text-zinc-950 hover:bg-accent/90 border border-transparent shadow-card",
  secondary: "bg-surface text-fg border border-line-strong hover:bg-surface-2 shadow-card",
  ghost: "bg-transparent text-muted hover:text-fg hover:bg-surface-2 border border-transparent",
  danger: "bg-danger text-white hover:bg-danger/90 border border-transparent shadow-card",
};
const sizes: Record<Size, string> = {
  sm: "h-7.5 px-2.5 text-[13px] gap-1.5 rounded-[7px]",
  md: "h-8.5 px-3.5 text-[13.5px] gap-2 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-[background-color,color,border-color,opacity] duration-120 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex size-7.5 shrink-0 items-center justify-center rounded-[7px] text-subtle transition-colors hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export type Tone = "neutral" | "success" | "danger" | "warn" | "info" | "accent" | "grey";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg border-line-strong",
  grey: "bg-surface-2 text-subtle border-line",
  success: "bg-success-soft text-success border-success/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  warn: "bg-warn-soft text-warn border-warn/25",
  info: "bg-info-soft text-info border-info/20",
  accent: "bg-accent-soft text-accent-ink border-accent/30",
};
const dots: Record<Tone, string> = {
  neutral: "bg-muted",
  grey: "bg-subtle/60",
  success: "bg-success",
  danger: "bg-danger",
  warn: "bg-warn",
  info: "bg-info",
  accent: "bg-accent",
};

export function Badge({ tone = "neutral", dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-5.5 items-center gap-1.5 rounded-full border px-2 text-[11.5px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className={clsx("size-1.5 rounded-full", dots[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[12.5px] text-subtle">{eyebrow}</div>}
        <h1 className="font-serif text-[34px] leading-[1.05] tracking-[-0.01em] text-fg sm:text-[40px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13.5px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-surface-3/70", className)} aria-hidden />;
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderCircle className={clsx("size-4 animate-spin text-subtle", className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-2 text-subtle">{icon}</div>}
      <p className="font-medium text-fg">{title}</p>
      {children && <p className="mt-1 max-w-sm text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex items-start gap-3 border-danger/25 bg-danger-soft p-4 text-[13.5px]">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <div className="flex-1">
        <p className="font-medium text-danger">Something went wrong</p>
        <p className="mt-0.5 text-muted">{error.message}</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function Swatch({ hex, label, size = 14, className }: { hex: string; label?: string; size?: number; className?: string }) {
  return (
    <span
      className={clsx("inline-block shrink-0 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/15", className)}
      style={{ background: hex, width: size, height: size }}
      title={label}
      aria-hidden={!label}
      role={label ? "img" : undefined}
      aria-label={label}
    />
  );
}

/** Frame + lens as two overlapping dots. */
export function ColorPair({ frame, lens, frameName, lensName }: { frame: string; lens: string; frameName: string; lensName: string }) {
  return (
    <span className="inline-flex items-center" role="img" aria-label={`${frameName} frame, ${lensName} lens`}>
      <Swatch hex={frame} size={14} />
      <span className="-ml-1.5 inline-flex rounded-full bg-surface p-[2px]">
        <Swatch hex={lens} size={14} />
      </span>
    </span>
  );
}
