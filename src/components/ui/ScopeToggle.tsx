"use client";

import { PixelIcon } from "@/components/ui/PixelIcon";

/** Pixel checkbox: count the time spent in other apps, or Chrome only. */
export function ScopeToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label="Include outside Chrome"
      onClick={() => onChange(!checked)}
      title={checked ? "Uncheck to see only what happens in Chrome" : "Check to add the time spent in other apps"}
      className="group inline-flex items-center gap-sm text-left"
    >
      <span
        aria-hidden
        className={`grid h-5 w-5 shrink-0 place-items-center border-2 shadow-[2px_2px_0_0_#000] ${
          checked ? "border-secondary-fixed bg-secondary-fixed text-on-secondary" : "border-outline bg-surface-container-lowest group-hover:border-secondary-fixed"
        }`}
      >
        {checked ? <PixelIcon name="check" size={12} /> : null}
      </span>
      <span>
        <span className={`block text-label ${checked ? "text-on-background" : "text-outline group-hover:text-on-background"}`}>INCLUDE OUTSIDE CHROME</span>
        <span className="block font-read text-read-sm text-outline">{checked ? "Whole computer: other apps count too" : "Chrome only: other apps are left out"}</span>
      </span>
    </button>
  );
}
