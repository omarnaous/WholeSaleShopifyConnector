import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "./ui";

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
}

const Ctx = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useConfirm outside ConfirmProvider");
  return v;
}

/** Promise-based confirm built on native <dialog>: focus trap, Esc and inert background for free. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    requestAnimationFrame(() => ref.current?.showModal());
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    ref.current?.close();
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <dialog
        ref={ref}
        className="modal m-auto w-[calc(100%-32px)] max-w-[420px] rounded-2xl border border-line bg-surface p-0 text-fg shadow-pop"
        aria-labelledby="confirm-title"
        onCancel={(e) => {
          e.preventDefault();
          close(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close(false);
        }}
      >
        {opts && (
          <div className="p-5">
            <h2 id="confirm-title" className="text-[15px] font-semibold">
              {opts.title}
            </h2>
            {opts.body && <div className="mt-1.5 text-[13.5px] text-muted">{opts.body}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => close(false)} autoFocus>
                Cancel
              </Button>
              <Button variant={opts.tone === "primary" ? "primary" : "danger"} onClick={() => close(true)}>
                {opts.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </Ctx.Provider>
  );
}
