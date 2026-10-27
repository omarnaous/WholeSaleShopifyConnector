import { memo, useState, type CSSProperties } from "react";
import { formatMoney, label, marginPct, type AppCatalogProduct } from "@lumen/core";
import { formatPct, LOW_STOCK } from "../lib/util";

interface Props {
  product: AppCatalogProduct;
  selected: boolean;
  /** False for items already in the store (re-importing a product deleted in Shopify is allowed). */
  selectable: boolean;
  onToggle: (id: string) => void;
  currency?: string;
}

export const ProductCard = memo(function ProductCard({ product, selected, selectable, onToggle, currency = "USD" }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const shownIdx = hoverIdx ?? activeIdx;
  const variant = product.variants[shownIdx] ?? product.variants[0];
  const totalStock = product.variants.reduce((n, v) => n + v.stock, 0);
  const imported = product.imported && product.imported.status !== "ORPHANED" ? product.imported : null;
  const orphaned = product.imported?.status === "ORPHANED";

  if (!variant) return null;
  const margin = marginPct(variant.wholesaleCost, variant.suggestedPrice);

  return (
    <div className="card" data-selected={selected || undefined} data-imported={imported ? true : undefined}>
      <s-box background="base" border="base" borderRadius="large" overflow="hidden">
        <div className="card-media" onClick={selectable ? () => onToggle(product.id) : undefined}>
          {product.variants.map((v, i) =>
            v.imageUrl ? (
              <div key={v.id} className="card-media__layer" data-active={i === shownIdx || undefined}>
                <s-image
                  src={v.imageUrl}
                  alt={`${product.name} sunglasses, ${v.frameColor} frame with ${v.lensColor} lenses`}
                  aspectRatio="4/3"
                  objectFit="cover"
                  inlineSize="fill"
                  loading={i === 0 ? "eager" : "lazy"}
                />
              </div>
            ) : null,
          )}
          {!product.variants.some((v) => v.imageUrl) && (
            <div className="card-media__placeholder">
              <s-icon type="image" color="subdued" />
            </div>
          )}

          <div className="card-media__corner card-media__corner--start" onClick={(e) => e.stopPropagation()}>
            {selectable ? (
              <s-checkbox
                checked={selected}
                accessibilityLabel={`Select ${product.name}`}
                labelAccessibilityVisibility="exclusive"
                label={`Select ${product.name}`}
                onChange={() => onToggle(product.id)}
              />
            ) : (
              <s-badge tone="success" icon="check">
                Imported
              </s-badge>
            )}
          </div>
          <div className="card-media__corner card-media__corner--end">
            {imported?.status === "DRAFT" && <s-badge tone="warning">Draft</s-badge>}
            {orphaned && <s-badge tone="neutral">Deleted in Shopify</s-badge>}
          </div>
        </div>

        <s-box padding="base">
          <s-stack gap="small-200">
            <s-stack direction="inline" justifyContent="space-between" alignItems="baseline" gap="small-200">
              <s-heading lineClamp={1}>{product.name}</s-heading>
              <s-text color="subdued" fontSize="small">
                {label(product.collection)}
              </s-text>
            </s-stack>

            <s-stack direction="inline" gap="small-300">
              <s-badge>{label(product.style)}</s-badge>
              {product.lensTypes.map((l) => (
                <s-badge key={l} tone="info">
                  {label(l)}
                </s-badge>
              ))}
            </s-stack>

            <div className="swatches" role="radiogroup" aria-label={`${product.name} colorways`} onMouseLeave={() => setHoverIdx(null)}>
              {product.variants.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={i === activeIdx}
                  aria-label={`${v.frameColor} frame, ${v.lensColor} lenses`}
                  title={`${v.frameColor} / ${v.lensColor}`}
                  className="swatch"
                  style={{ "--frame": v.frameColorHex, "--lens": v.lensColorHex } as CSSProperties}
                  onMouseEnter={() => setHoverIdx(i)}
                  onFocus={() => setHoverIdx(i)}
                  onBlur={() => setHoverIdx(null)}
                  onClick={() => setActiveIdx(i)}
                />
              ))}
              <span className="swatches__label">
                <s-text color="subdued" fontSize="small">
                  {variant.frameColor} / {variant.lensColor}
                </s-text>
              </span>
            </div>

            <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="small-200">
              <PriceCell label="Your cost" value={formatMoney(variant.wholesaleCost, currency)} />
              <PriceCell label="Suggested retail" value={formatMoney(variant.suggestedPrice, currency)} />
              <PriceCell label="Margin" value={formatPct(margin)} tone={margin >= 50 ? "success" : margin > 0 ? "auto" : "critical"} />
            </s-grid>

            <s-stack direction="inline" gap="small-200" alignItems="center">
              {totalStock === 0 ? (
                <s-badge tone="critical">Out of stock</s-badge>
              ) : totalStock < LOW_STOCK ? (
                <s-badge tone="warning">Low stock · {totalStock}</s-badge>
              ) : (
                <s-text color="subdued" fontSize="small">
                  {totalStock} in stock across {product.variants.length} colorways
                </s-text>
              )}
              {variant.stock === 0 && totalStock > 0 && (
                <s-text tone="caution" fontSize="small">
                  This colorway is sold out
                </s-text>
              )}
            </s-stack>
          </s-stack>
        </s-box>
      </s-box>
    </div>
  );
});

function PriceCell({ label: text, value, tone = "auto" }: { label: string; value: string; tone?: "auto" | "success" | "critical" }) {
  return (
    <s-stack gap="small-500">
      <s-text color="subdued" fontSize="small">
        {text}
      </s-text>
      <s-text fontWeight="semibold" tone={tone} fontVariantNumeric="tabular-nums">
        {value}
      </s-text>
    </s-stack>
  );
}
