import { COLLECTIONS, GENDERS, LENS_TYPES, STYLES, label, type CatalogFilters } from "@lumen/core";

export type ListFilterKey = "collection" | "style" | "frameColor" | "lensType" | "gender";

interface Props {
  filters: CatalogFilters;
  search: string;
  onSearch: (q: string) => void;
  onChange: (next: CatalogFilters) => void;
  frameColors: { name: string; hex: string }[];
}

export const hasActiveFilters = (f: CatalogFilters, search: string) =>
  Boolean(search.trim() || f.inStock || f.collection?.length || f.style?.length || f.frameColor?.length || f.lensType?.length || f.gender?.length);

export function CatalogFilterBar({ filters, search, onSearch, onChange, frameColors }: Props) {
  const groups: { key: ListFilterKey; title: string; options: { value: string; label: string }[] }[] = [
    { key: "collection", title: "Collection", options: COLLECTIONS.map((v) => ({ value: v, label: label(v) })) },
    { key: "style", title: "Style", options: STYLES.map((v) => ({ value: v, label: label(v) })) },
    { key: "frameColor", title: "Frame color", options: frameColors.map((c) => ({ value: c.name, label: c.name })) },
    { key: "lensType", title: "Lens", options: LENS_TYPES.map((v) => ({ value: v, label: label(v) })) },
    { key: "gender", title: "Gender", options: GENDERS.map((v) => ({ value: v, label: label(v) })) },
  ];

  const set = (key: ListFilterKey, values: string[]) => onChange({ ...filters, [key]: values.length ? values : undefined });
  const chips = groups.flatMap((g) => (filters[g.key] ?? []).map((v) => ({ key: g.key, value: v, text: g.key === "frameColor" ? v : label(v) })));

  return (
    <s-stack gap="base">
      <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="center">
        <s-search-field
          label="Search catalog"
          labelAccessibilityVisibility="exclusive"
          placeholder="Search by name, color or SKU"
          value={search}
          onInput={(e) => onSearch(e.currentTarget.value)}
        />
        <s-switch label="In stock only" checked={Boolean(filters.inStock)} onChange={(e) => onChange({ ...filters, inStock: e.currentTarget.checked || undefined })} />
      </s-grid>

      <s-stack direction="inline" gap="small-200" alignItems="center">
        {groups.map((g) => {
          const selected = filters[g.key] ?? [];
          const id = `filter-${g.key}`;
          return (
            <span key={g.key}>
              <s-button commandFor={id} icon="caret-down">
                {selected.length ? `${g.title} · ${selected.length}` : g.title}
              </s-button>
              <s-popover id={id} minInlineSize="0">
                <s-box padding="base">
                  <s-choice-list
                    label={g.title}
                    labelAccessibilityVisibility="exclusive"
                    multiple
                    onChange={(e) => set(g.key, e.currentTarget.values ?? [])}
                  >
                    {g.options.map((o) => (
                      <s-choice key={o.value} value={o.value} selected={selected.includes(o.value)}>
                        {o.label}
                      </s-choice>
                    ))}
                  </s-choice-list>
                </s-box>
              </s-popover>
            </span>
          );
        })}

        {chips.map((c) => (
          <s-clickable-chip
            key={`${c.key}:${c.value}`}
            accessibilityLabel={`Remove filter ${c.text}`}
            onClick={() => set(c.key, (filters[c.key] ?? []).filter((v) => v !== c.value))}
          >
            <s-icon slot="graphic" type="x" size="small" />
            {c.text}
          </s-clickable-chip>
        ))}
      </s-stack>
    </s-stack>
  );
}
