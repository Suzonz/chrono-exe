"use client";

import { PixelIcon } from "@/components/ui/PixelIcon";

/** Pixel checkbox with a label and an optional line of detail under it. */
export function PixelCheckbox({
  checked,
  onChange,
  label,
  detail,
  title
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  detail?: string;
  title: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      title={title}
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
        <span className={`block text-label ${checked ? "text-on-background" : "text-outline group-hover:text-on-background"}`}>{label}</span>
        {detail ? <span className="block font-read text-read-sm text-outline">{detail}</span> : null}
      </span>
    </button>
  );
}

/** Count the time spent in other apps, or Chrome only. */
export function ScopeToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <PixelCheckbox
      checked={checked}
      onChange={onChange}
      label="INCLUDE OUTSIDE CHROME"
      detail={checked ? "Whole computer: other apps count too" : "Chrome only: other apps are left out"}
      title={checked ? "Uncheck to see only what happens in Chrome" : "Check to add the time spent in other apps"}
    />
  );
}
