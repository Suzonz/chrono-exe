"use client";

export function DateNavigator({
  label,
  onPrev,
  onNext,
  onToday,
  disableNext = false,
  isCurrent = false
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
  disableNext?: boolean;
  isCurrent?: boolean;
}) {
  const button =
    "px-sm py-xs text-label text-on-background hover:text-secondary-fixed disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-on-background";
  return (
    <div className="flex items-center gap-sm">
      <div className="flex items-center border border-primary-container">
        <button type="button" onClick={onPrev} className={button} aria-label="Previous period">
          {"<"}
        </button>
        <span className="min-w-[13ch] px-sm text-center text-label uppercase tracking-widest text-primary" aria-live="polite">
          {label}
        </span>
        <button type="button" onClick={onNext} disabled={disableNext} className={button} aria-label="Next period">
          {">"}
        </button>
      </div>
      {onToday && !isCurrent ? (
        <button
          type="button"
          onClick={onToday}
          className="border border-outline-variant px-sm py-xs text-ui-small text-outline hover:border-secondary-fixed hover:text-secondary-fixed"
        >
          TODAY
        </button>
      ) : null}
    </div>
  );
}
