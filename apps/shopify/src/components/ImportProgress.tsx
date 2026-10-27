import type { ImportJobState } from "@lumen/core";
import { pluralize } from "../lib/util";

interface Props {
  job: ImportJobState;
  nameOf: (productId: string) => string;
  onDismiss: () => void;
}

/** Live view of an import job (polled by the catalog page). */
export function ImportProgress({ job, nameOf, onDismiss }: Props) {
  const processed = job.done + job.failed;
  const finished = job.status === "done" || job.status === "failed";
  const pct = job.total ? Math.round((processed / job.total) * 100) : 0;
  const tone = finished ? (job.failed ? (job.done ? "warning" : "critical") : "success") : "info";

  const heading = finished
    ? job.failed
      ? job.done
        ? `Imported ${pluralize(job.done, "product")}, ${job.failed} failed`
        : "Import failed"
      : `Imported ${pluralize(job.done, "product")}`
    : job.status === "queued"
      ? `Preparing to import ${pluralize(job.total, "product")}…`
      : `Importing ${pluralize(job.total, "product")}…`;

  return (
    <s-section heading={heading} accessibilityLabel="Import progress">
      {finished ? (
        <s-button slot="secondary-actions" variant="tertiary" onClick={onDismiss}>
          Dismiss
        </s-button>
      ) : (
        <s-badge slot="accessory" tone="info">
          In progress
        </s-badge>
      )}
      <s-stack gap="small">
        <s-progress value={processed} max={Math.max(job.total, 1)} tone={tone} accessibilityLabel={`${pct}% of products processed`} />
        <s-stack direction="inline" justifyContent="space-between" gap="base">
          <s-text color="subdued" fontVariantNumeric="tabular-nums">
            {processed} of {job.total} processed · {job.done} imported{job.failed ? ` · ${job.failed} failed` : ""}
          </s-text>
          <s-text color="subdued" fontVariantNumeric="tabular-nums">
            {pct}%
          </s-text>
        </s-stack>
        {!finished && (
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-spinner size="base" accessibilityLabel="Import in progress" />
            <s-text color="subdued">
              Products are created as Active with the suggested retail price, cost per item and stock at your default location. You can keep browsing.
            </s-text>
          </s-stack>
        )}
        {job.errors.length > 0 && (
          <s-banner tone="critical" heading={`${pluralize(job.errors.length, "product")} couldn't be imported`}>
            <s-unordered-list>
              {job.errors.map((e) => (
                <s-list-item key={e.productId}>
                  <s-text fontWeight="semibold">{nameOf(e.productId)}</s-text>: {e.message}
                </s-list-item>
              ))}
            </s-unordered-list>
            <s-paragraph>Retry by selecting them again — products that already imported are skipped.</s-paragraph>
          </s-banner>
        )}
      </s-stack>
    </s-section>
  );
}
