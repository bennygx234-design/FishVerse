# Design system

A dark "liquid glass" interface: translucent layered panels, bright inner top edges, deep
shadows, over a background of soft colour washes. Everything lives in `css/styles.css`.

## Type

| Role | Family | Notes |
| --- | --- | --- |
| Display, numerals, buttons | **Outfit** 300-800 | headings, stat values, money |
| Interface text | **Plus Jakarta Sans** 400-800 | body, labels, descriptions |

Both are variable latin subsets, embedded in the stylesheet as base64 `data:` URIs. That is
deliberate: a page opened from a `file://` path cannot fetch a separate font file
(cross-origin font rules), and inlining also removes two requests and any flash of fallback
text. The `.woff2` sources stay in `fonts/` with their licence note; to swap a font,
re-encode it and replace the `src:` value in the matching `@font-face` block.

All monetary and numeric text uses `font-variant-numeric: tabular-nums` so figures do not
jitter as they tick.

## Colour

Tokens are defined once on `:root`.

| Token | Value | Use |
| --- | --- | --- |
| `--ink` → `--ink-4` | `#eef3fd` → `#64718c` | text, four levels of emphasis |
| `--blue` | `#5b9cff` | primary actions, selection, valuation |
| `--mint` | `#2ee0b8` | profit, positive change, success |
| `--amber` | `#ffc043` | money, rewards, warnings, paused state |
| `--rose` | `#ff6b74` | loss, debt, danger |
| `--violet` | `#9d8cff` | quests, rival trends |

Each accent has a matching `--tint-*` at low alpha for badge and chip backgrounds.

## Glass

```css
background: var(--glass);            /* layered translucent white over the page wash */
border: 1px solid var(--edge);       /* bright hairline */
box-shadow: var(--lift-2);           /* ambient + directional + inset top highlight */
```

Three elevations: `--lift-1` controls and chips, `--lift-2` panels and cards, `--lift-3`
modals and hovered cards. Depressed surfaces (segmented controls, inputs, progress tracks)
use `--press`, an inset shadow.

**`backdrop-filter` is not used anywhere, on purpose.** It looked right but a full-screen or
always-visible blurred layer forces the compositor to read back the whole viewport every
frame. Measured on a 30-business save at 8x speed:

| Configuration | FPS |
| --- | --- |
| With `backdrop-filter` on the rails and modal | 19 |
| Same, blur radius reduced to 2px | 16 |
| Without it | 60 |

The cost is per-layer, not per-radius. Since the rails sit over a smooth gradient, the blur
was nearly invisible anyway; richer translucent fills give the same read for free. The modal
uses a deeper radial scrim instead.

## Shape and motion

Radii: `28px` modals and rails, `22px` cards, `16px` rows and inputs, `999px` buttons,
chips, badges and bars.

Motion is short and eased: `.16-.25s` for interaction, `.6-.7s` for value bars,
`cubic-bezier(.2,.9,.3,1)` for entrances. Everything collapses under
`prefers-reduced-motion`, including confetti, which is skipped entirely.

## Icons

Interface icons are inline SVG from [Lucide](https://lucide.dev) (ISC), generated into
`js/icons.js` as path data and rendered by `MM_ICONS(name, size)`. They inherit
`currentColor` and use a 1.9 stroke.

Static markup declares `data-icon="store" data-size="20"` and `UI.hydrateIcons()` fills it
in, so `index.html` stays readable.

Emoji are **game content only**: products, business types, events, achievements. They always
sit inside an `.emo` tile or an `.ico` square so they read as deliberate artwork rather than
as text decoration.

## Layout

A CSS grid shell with gaps, so the rails float as separate glass panels.

| Breakpoint | Layout |
| --- | --- |
| ≥ 1500px | full sidebar with labels, activity rail, six stat columns |
| < 1500px | icon-only sidebar, three stat columns |
| < 1200px | activity rail becomes a slide-over drawer behind a toolbar button |
| < 760px | bottom tab bar, compact two-row top bar, two stat columns, stacked cards |

No view may scroll horizontally; wide tables scroll inside their own `.table-wrap`.

## Components

`.btn` (`primary`, `gold`, `mint`, `danger`, `ghost`, `sm`, `xs`, `block`), `.iconbtn`,
`.badge`, `.chip`, `.trend` pills, `.bar` progress, `.toggle`, `.tabs` segmented control,
`.card`, `.stat-card`, `.biz-card`, `.upgrade-row`, `.branch`, `.prod-row`, `.toast`,
`.modal-box`, `.table.ledger`.
