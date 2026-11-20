import type { CategoryRef } from "@/types";
import { colorHex } from "@/lib/palette";

/** Color swatch + text label (never color-only, for accessibility). */
export function CategoryBadge({
  category,
  size = "label",
  className = ""
}: {
  category: Pick<CategoryRef, "name" | "color">;
  size?: "ui-small" | "label" | "body" | "h2";
  className?: string;
}) {
  const swatch = size === "h2" || size === "body" ? "h-3 w-3" : "h-2 w-2";
  const text = { h2: "text-h2", body: "text-body", label: "text-label", "ui-small": "text-ui-small" }[size];
  return (
    <span className={`inline-flex min-w-0 items-center gap-xs ${text} ${className}`}>
      <span aria-hidden className={`${swatch} shrink-0`} style={{ backgroundColor: colorHex(category.color) }} />
      <span className="truncate" style={{ color: colorHex(category.color) }}>
        {category.name}
      </span>
    </span>
  );
}
