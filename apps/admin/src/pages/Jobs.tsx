import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { clsx } from "clsx";
import { Activity, Pause, Play } from "lucide-react";
import type { AdminJobRow } from "@lumen/core";
import { api } from "../api";
import { useAsync } from "../lib/useAsync";
import { dateTime, duration, timeAgo } from "../lib/format";
import { JobKind, JobStatusBadge } from "../components/badges";
import { Segmented } from "../components/Segmented";
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from "../components/ui";
import { listItem, listParent } from "../components/motion";

type StatusFilter = "all" | AdminJobRow["status"];
type KindFilter = "" | AdminJobRow["kind"];
const POLL_MS = 5000;

export function JobsPage() {
  const jobs = useAsync(api.jobs);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<KindFilter>("");
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (jobs.data) setUpdatedAt(Date.now());
  }, [jobs.data]);

  // Poll while visible; pause in background tabs.
  useEffect(() => {
    if (!live) return;
    const tick = () => {
      if (document.visibilityState === "visible") void jobs.reload();
    };
    const t = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [live, jobs.reload]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const all = jobs.data ?? [];
  const counts = useMemo(() => {
    const c = { all: 0, queued: 0, running: 0, done: 0, failed: 0 };
    for (const j of all) {
      if (kind && j.kind !== kind) continue;
      c.all++;
      c[j.status]++;
    }
    return c;
  }, [all, kind]);
  const rows = all.filter((j) => (status === "all" || j.status === status) && (!kind || j.kind === kind));
  const secs = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;

  return (
    <>
      <PageHeader
        title="Sync jobs"
        description="Imports, stock & cost syncs and status flips pushed to subscriber stores. Latest 200."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 text-[12.5px] text-muted" aria-live="off">
              <span className="relative flex size-2">
                <span className={clsx("absolute inset-0 rounded-full", live ? "animate-pulse-dot bg-success" : "bg-subtle/50")} aria-hidden />
              </span>
              {live ? "Live" : "Paused"}
              {secs !== null && <span className="text-subtle tabular-nums">· updated {secs < 2 ? "now" : `${secs}s ago`}</span>}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setLive((l) => !l)}
              aria-pressed={!live}
              icon={live ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
            >
              {live ? "Pause" : "Resume"}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="max-w-full overflow-x-auto">
          <Segmented
            id="job-status"
            label="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "queued", label: "Queued", count: counts.queued },
              { value: "running", label: "Running", count: counts.running },
              { value: "done", label: "Done", count: counts.done },
              { value: "failed", label: "Failed", count: counts.failed },
            ]}
          />
        </div>
        <label htmlFor="job-kind" className="sr-only">
          Job kind
        </label>
        <select id="job-kind" value={kind} onChange={(e) => setKind(e.target.value as KindFilter)} className="field w-auto min-w-[140px]">
          <option value="">All kinds</option>
          <option value="import">Import</option>
          <option value="sync">Sync</option>
          <option value="status">Status</option>
        </select>
      </div>

      {jobs.error && !jobs.data ? (
        <ErrorState error={jobs.error} onRetry={jobs.reload} />
      ) : !jobs.data ? (
        <div className="card overflow-hidden">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-0">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Activity className="size-5" aria-hidden />} title={all.length ? "No jobs match these filters" : "No sync jobs yet"}>
            {all.length ? "Try another status or kind." : "Jobs show up here when stores import products or when stock and cost change."}
          </EmptyState>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {jobs.error && (
            <p role="status" className="border-b border-line bg-warn-soft px-4 py-2 text-[12.5px] text-warn">
              Live refresh failed: {jobs.error.message}. Showing the last loaded data.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-separate border-spacing-0 text-[13.5px]">
              <caption className="sr-only">Sync jobs, newest first</caption>
              <thead>
                <tr>
                  <th className="th pl-4" scope="col">
                    Status
                  </th>
                  <th className="th" scope="col">
                    Kind
                  </th>
                  <th className="th" scope="col">
                    Product
                  </th>
                  <th className="th" scope="col">
                    Store
                  </th>
                  <th className="th" scope="col">
                    Error
                  </th>
                  <th className="th" scope="col">
                    Created
                  </th>
                  <th className="th pr-4 text-right" scope="col">
                    Took
                  </th>
                </tr>
              </thead>
              <motion.tbody variants={listParent} initial="hidden" animate="show">
                {rows.map((j) => (
                  <motion.tr key={j.id} variants={listItem} className={clsx("transition-colors hover:bg-surface-2/40", j.status === "failed" && "bg-danger-soft/40")}>
                    <td className="td pl-4">
                      <JobStatusBadge status={j.status} />
                    </td>
                    <td className="td">
                      <JobKind kind={j.kind} />
                    </td>
                    <td className="td font-medium">{j.productName ?? <span className="font-normal text-subtle">Whole store</span>}</td>
                    <td className="td text-muted">{j.shop}</td>
                    <td className="td max-w-[280px]">
                      {j.error ? (
                        <span className="line-clamp-2 text-[12.5px] text-danger" title={j.error}>
                          {j.error}
                        </span>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="td whitespace-nowrap">
                      <time dateTime={j.createdAt} title={dateTime(j.createdAt)}>
                        {timeAgo(j.createdAt, now)}
                      </time>
                      <span className="block text-[11.5px] text-subtle">{dateTime(j.createdAt)}</span>
                    </td>
                    <td className="td pr-4 text-right whitespace-nowrap text-muted tabular-nums" title={j.finishedAt ? `Finished ${dateTime(j.finishedAt)}` : undefined}>
                      {duration(j.createdAt, j.finishedAt) ?? <span className="text-subtle">—</span>}
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
