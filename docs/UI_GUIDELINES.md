# CHRONO.EXE: UI guidelines

The look is an **old arcade game / terminal**: dark violet surfaces, hard square edges, pixel fonts, pixel-art graphics and a light CRT scanline overlay. The tokens live in `tailwind.config.ts`, and the base styles in `src/styles/globals.css`.

## 1. Principles

1. **Readable first, retro second.** Titles and numbers use the pixel font. Sentences use the readable pixel font. Nothing below 8px.
2. **Every block explains itself.** Each widget has a short title and a one-sentence hint (a `(?)` tooltip on dense screens such as SESSION).
3. **Same rules everywhere.** The same ring, colors, productivity score and scope checkbox are used on SESSION and HISTORY.
4. **Interface in English**, sentence style for hints, UPPERCASE for titles and labels.
5. **Desktop first.** SESSION fits one screen from 1280px wide. Below that, blocks stack and the page scrolls.

## 2. Typography

| Use | Font | Class |
| --- | --- | --- |
| Titles, labels, numbers, buttons | *Press Start 2P* | `font-pixel` (default), `text-h1` 24, `text-h2` 18, `text-label` 10, `text-ui-small` 8 |
| Sentences, lists, hints | *VT323* | `font-read text-read` (20px) / `text-read-sm` (17px) |

Press Start 2P has no glyphs for `▸ ◂ → ▲` or typographic apostrophes. Use ASCII (`> < -`) instead, and draw icons as pixel sprites (see below). In JSX, write `{"<"}` / `{">"}`.

## 3. Color

| Role | Token | Hex |
| --- | --- | --- |
| Page | `background`, `surface-dim` | `#15121b` |
| Widget | `surface-container-high` | `#2c2833` |
| Wells (bars, charts) | `surface-container-lowest` | `#100d16` |
| Widget border / brand violet | `primary-container` | `#7c3aed` |
| Titles, "live", positive | `secondary-fixed` | `#15ffd1` |
| Paused, warnings | `tertiary` | `#ffb784` |
| Errors, limits, stop | `error` / `error-container` | `#ffb4ab` / `#93000a` |
| Body text / muted | `on-background` / `outline` | `#e8dfee` / `#958da1` |

**Category colors** come from a fixed palette of 16 names (`violet`, `cyan`, `green`, `amber`, `teal`…) in `src/lib/palette.ts`. A category always has the same color on every screen and in the extension popup.

**Productivity** has its own colors: productive `#15ffd1`, neutral `#958da1`, distracting `#ff6b8a`.

## 4. Shape and spacing

- **No rounded corners** (`borderRadius` is 0 everywhere except `full`).
- Spacing scale: `xs` 4, `sm` 8, `md` 16, `lg` 24, `xl` 32. The gap between widgets is `widget-gutter` (12px).
- **Hard drop shadows** (`shadow-[5px_5px_0_0_#000]`) on arcade buttons only. A pressed button slides into its shadow (`active:translate`).

## 5. Components

| Component | Use |
| --- | --- |
| `Widget` | Every block: violet border, title in `secondary-fixed`, optional `meta` on the right, `hint` sentence (or `(?)` with `compact`) |
| `PixelIcon` | 7×7 SVG sprites (`play`, `pause`, `stop`, `minus`, `plus`, `check`), drawn with `crispEdges` |
| `TrackingControls` | Big square arcade buttons: one ▶/❚❚ toggle and ■. Icon only, with the label in `aria-label` and `title` |
| `TimeRing` | Pixel donut (29×29 grid). The center shows the total, or the hovered category. The legend shows %, duration and limits |
| `ProductiveCounter` | Live productive time, segmented progress bar, − / + goal (15 min steps) |
| `DayTimeline` | One column per hour (0–60 min), stacked by category, 5-minute pixel grid, away time hatched, ‹ › NOW navigation |
| `SegmentedBar` | Retro progress bar made of blocks |
| `ScopeToggle` | Pixel checkbox INCLUDE OUTSIDE CHROME |
| Tabs | Joined square buttons, the selected one filled violet: DAY / WEEK / MONTH in HISTORY, SESSION / TODAY in the header of the home page |
| `CategoryBadge` | Color square + category name |
| `ErrorPanel`, `Loading`, `Empty`, `StatusBanner` | States: `SYS.ERR // …` panels, blinking `LOADING...`, banners for connection lost, database offline, server off and extension silent |

## 6. Patterns

- **Pixel graphics.** Charts are drawn as grids of square cells with a small gap (the ring) or with a 5-minute line grid (hour columns), never smooth curves or gradients.
- **Hover links things together.** Hovering a ring slice highlights its legend row and the reverse. Hovering an hour column prints its detail under the chart.
- **Numbers.** Durations use `HH:MM:SS` when they tick live, and `2h 05m` / `93h 25m` otherwise. Trends always name what they compare with: `+35m vs yesterday`, `-4 pts vs last week`.
- **Empty and error states** say what to do next. For example: "Server off. Press play in the Chrome extension."
- **Motion** is limited to blinking (`animate-blink`) for live or waiting states and a pulsing border when recording without the extension.

## 7. Accessibility

- Icon-only buttons have `aria-label` and `title`. The checkbox uses `role="checkbox"` and `aria-checked`.
- Live values use `aria-live="polite"`. Charts have `role="img"` with a text label, and details are also available as text on hover.
- A skip link is provided (SKIP TO CONTENT). Information never relies on color alone: names and percentages are always written next to the colors.
