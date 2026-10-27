import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { api, ApiError } from "../api";
import { useAuth } from "../components/Auth";
import { Wordmark } from "../components/Layout";
import { Button } from "../components/ui";

export function LoginPage() {
  const { signIn } = useAuth();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return setError("Enter the admin password");
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.login(password);
      signIn(token);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "That password isn't right" : (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-[50%] opacity-60 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--accent) 30%, transparent), transparent)" }}
      />
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[380px]"
      >
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>
        <div className="card p-6 shadow-pop sm:p-7">
          <h1 className="font-serif text-[34px] leading-none">Wholesale admin</h1>
          <p className="mt-2 text-[13.5px] text-muted">Manage the catalog that syndicates to every subscriber store.</p>
          <form onSubmit={submit} className="mt-6" noValidate>
            <label htmlFor="password" className="label">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? "password-error" : undefined}
                className="field h-10 pr-10 pl-8.5"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1.5 text-subtle hover:text-fg"
                aria-label={show ? "Hide password" : "Show password"}
                aria-pressed={show}
              >
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
            {error && (
              <p id="password-error" role="alert" className="mt-2 text-[12.5px] text-danger">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" loading={busy} className="mt-5 h-10 w-full">
              Sign in {!busy && <ArrowRight className="size-4" aria-hidden />}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-[12px] text-subtle">Sessions last 12 hours.</p>
      </motion.main>
    </div>
  );
}
