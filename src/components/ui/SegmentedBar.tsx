/** Retro "LED" progress bar made of discrete segments. */
export function SegmentedBar({
  value,
  total = 20,
  color = "#7c3aed",
  heightClass = "h-2",
  label
}: {
  value: number;
  total?: number;
  color?: string;
  heightClass?: string;
  label?: string;
}) {
  const bounded = Math.max(0, Math.min(100, value));
  const filled = bounded > 0 ? Math.max(1, Math.round((bounded / 100) * total)) : 0;
  return (
    <div
      className={`flex w-full gap-[2px] ${heightClass}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(bounded)}
      aria-label={label}
    >
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          className={`flex-1 ${index < filled ? "" : "border border-outline-variant bg-surface-container-lowest"}`}
          style={index < filled ? { backgroundColor: color } : undefined}
        />
      ))}
    </div>
  );
}
