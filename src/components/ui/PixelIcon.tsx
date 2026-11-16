/**
 * Pixel-art media icons drawn on a 7×7 grid. SVG with crisp edges keeps them
 * sharp at any size, independent of the pixel font's glyph coverage.
 */

const SPRITES = {
  play: ["X......", "XXX....", "XXXXX..", "XXXXXXX", "XXXXX..", "XXX....", "X......"],
  pause: [".XX.XX.", ".XX.XX.", ".XX.XX.", ".XX.XX.", ".XX.XX.", ".XX.XX.", ".XX.XX."],
  stop: [".......", ".XXXXX.", ".XXXXX.", ".XXXXX.", ".XXXXX.", ".XXXXX.", "......."]
} as const;

export type PixelIconName = keyof typeof SPRITES;

export function PixelIcon({ name, size = 14, className = "" }: { name: PixelIconName; size?: number; className?: string }) {
  const rows = SPRITES[name];
  return (
    <svg
      aria-hidden
      viewBox="0 0 7 7"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`inline-block shrink-0 ${className}`}
      fill="currentColor"
    >
      {rows.flatMap((row, y) =>
        Array.from(row).map((cell, x) => (cell === "X" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null))
      )}
    </svg>
  );
}
