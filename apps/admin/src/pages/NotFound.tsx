import { Link } from "react-router";
import { Glasses } from "lucide-react";
import { EmptyState } from "../components/ui";

export function NotFoundPage() {
  return (
    <div className="card mt-10">
      <EmptyState
        icon={<Glasses className="size-5" aria-hidden />}
        title="Nothing to see here"
        action={
          <Link to="/" className="text-[13.5px] font-medium text-accent-ink underline-offset-4 hover:underline">
            Back to overview
          </Link>
        }
      >
        That page doesn't exist — it may have been moved or archived.
      </EmptyState>
    </div>
  );
}
