import { formatCompact } from "@/lib/time";

/**
 * "▲ 35M VS YESTERDAY" — green when better, red when worse.
 * `kind="time"` compares durations, `kind="points"` compares percentages.
 */
export function Trend({
  current,
  previous,
  label,
  kind = "time",
  higherIsBetter = true
}: {
  current: number | null;
  previous: number | null;
  label: string;
  kind?: "time" | "points";
  higherIsBetter?: boolean;
}) {
  if (current === null || previous === null || (kind === "time" && previous === 0 && current === 0)) {
    return <span className="font-read text-read-sm text-outline">No data {label} to compare</span>;
  }
  const delta = current - previous;
  const tiny = kind === "time" ? Math.abs(delta) < 60 : delta === 0;
  if (tiny) {
    return <span className="font-read text-read-sm text-outline">= Same as {label}</span>;
  }
  const better = delta > 0 === higherIsBetter;
  const amount = kind === "time" ? formatCompact(Math.abs(delta)).toLowerCase() : `${Math.abs(delta)} pts`;
  return (
    <span className={`font-read text-read-sm ${better ? "text-secondary-fixed" : "text-error"}`}>
      {delta > 0 ? "+" : "-"}
      {amount} vs {label}
    </span>
  );
}
