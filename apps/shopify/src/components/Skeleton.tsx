/** Shown while GET /api/app/state bootstraps (and installs) the store. */
export function AppSkeleton() {
  return (
    <s-page heading="Lumen Wholesale" inlineSize="large">
      <s-stack gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-spinner accessibilityLabel="Loading your store" size="base" />
          <s-text color="subdued">Connecting to your store…</s-text>
        </s-stack>
        <CardGridSkeleton count={8} />
      </s-stack>
    </s-page>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="card-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton skeleton--media" />
          <div className="skeleton-card__body">
            <div className="skeleton skeleton--line" style={{ width: "60%" }} />
            <div className="skeleton skeleton--line" style={{ width: "40%" }} />
            <div className="skeleton skeleton--line" style={{ width: "80%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <s-section>
      <s-stack gap="base" accessibilityLabel="Loading">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton-row" aria-hidden="true">
            <div className="skeleton skeleton--thumb" />
            <div className="skeleton-row__lines">
              <div className="skeleton skeleton--line" style={{ width: "45%" }} />
              <div className="skeleton skeleton--line" style={{ width: "70%" }} />
            </div>
          </div>
        ))}
      </s-stack>
    </s-section>
  );
}
