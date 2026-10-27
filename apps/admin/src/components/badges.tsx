import type { AdminJobRow, SubscriptionStatus } from "@lumen/core";
import { LoaderCircle } from "lucide-react";
import { Badge, type Tone } from "./ui";

const SUB_TONE: Record<SubscriptionStatus, Tone> = {
  ACTIVE: "success",
  PENDING: "neutral",
  ACCEPTED: "neutral",
  CANCELLED: "danger",
  DECLINED: "danger",
  FROZEN: "warn",
  EXPIRED: "warn",
  NONE: "grey",
};

export function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <Badge tone={SUB_TONE[status] ?? "grey"} dot>
      {status === "NONE" ? "No plan" : status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

const JOB_TONE: Record<AdminJobRow["status"], Tone> = { queued: "grey", running: "info", done: "success", failed: "danger" };

export function JobStatusBadge({ status }: { status: AdminJobRow["status"] }) {
  return (
    <Badge tone={JOB_TONE[status]} dot={status !== "running"}>
      {status === "running" && <LoaderCircle className="size-3 animate-spin" aria-hidden />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

const KIND_LABEL: Record<AdminJobRow["kind"], string> = { import: "Import", sync: "Sync", status: "Status" };

export function JobKind({ kind }: { kind: AdminJobRow["kind"] }) {
  return (
    <span className="inline-flex min-w-[54px] items-center justify-center rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px] text-muted">{KIND_LABEL[kind] ?? kind}</span>
  );
}

export function ProductStatusBadge({ status }: { status: "active" | "archived" }) {
  return status === "active" ? (
    <Badge tone="success" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="grey" dot>
      Archived
    </Badge>
  );
}
