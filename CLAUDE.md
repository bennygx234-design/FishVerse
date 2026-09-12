# Working in this repository

Market Mayhem is a browser-based business tycoon game. Plain HTML, CSS and JavaScript.
**No frameworks, no build step, no bundler, no package.json, no network calls at runtime.**
Open `index.html` and it runs.

Keep it that way. If a change would introduce a build step or a runtime dependency, find
another way.

## Run it

```bash
# any static server; a file:// path also works (fonts are inlined for that reason)
python3 -m http.server 8000
```

## Test it

There is no test framework. There are two harnesses, and both matter.

**Balance (headless, Node).** The engine has no DOM dependency, so it runs in Node:

```bash
node tools/sim.js 6          # 6 auto-played games, prints pacing and margins
```

The auto-player should win **5-7 of 8** runs, median **1,400-1,800 days**, at **30-40% net
margin**. If a change moves the median outside that band, it changed the game's difficulty —
say so explicitly rather than letting it drift.

**Browser.** Serve the folder with any static server and drive the real page: click through
every view, run at 8x, watch for `pageerror` and `console.error`. Zero console errors is the
bar. `window.MM.game` is the engine instance, so days can be advanced from the console.

## Layout

```
index.html        page shell; static markup only, icons hydrated from data-icon
css/styles.css    the whole design system, plus both fonts as base64 data URIs
fonts/            the .woff2 sources for those data URIs
js/data.js        all tuning data: products, business types, upgrades, events, rivals,
                  quests, achievements, tax brackets, economy constants
js/engine.js      the simulation. No DOM. Runs in Node. Owns all game rules
js/icons.js       generated inline SVG icon set (Lucide, ISC)
js/charts.js      canvas charts: sparkline, line, grouped bars
js/ui.js          views, refresh loop, bindings, toasts, modals, sound, confetti
js/main.js        game loop, start screen, keyboard, persistence, watchdogs
tools/sim.js      headless balance harness
docs/             architecture, game design, design system
```

Data flows one way: `data.js` → `engine.js` → (events) → `ui.js` → DOM. The UI never
computes game rules; it asks the engine. If you find yourself doing arithmetic on game
state inside `ui.js`, the calculation belongs in `engine.js`.

## Conventions

- **Tuning lives in `js/data.js`.** Magic numbers in `engine.js` that a designer might want
  to change belong in `ECONOMY`, `TAX_BRACKETS` or the upgrade definitions instead.
- **Upgrade effects are declarative.** An upgrade's `fx` object is summed per level by
  `Game.bizEff` / `Game.hqEff`. Adding an upgrade should not require an `if` in the engine;
  add the effect key and read it where it applies.
- **The UI re-renders structurally only when the shape changes.** `UI.computeStructKey()`
  builds a signature; when it changes the view is rebuilt, otherwise only `data-f` fields
  are updated in place. Adding state that should force a rebuild means adding it to that key.
- **Icons are `data-icon` attributes** hydrated by `UI.hydrateIcons()`. Emoji are game
  content only (products, businesses, events) and always sit in an `.emo` tile.
- **Money is formatted by `Game.fmt`.** It returns `$—` for non-finite input, so never
  hand-roll currency strings.

## Invariants that cost real bugs to learn

1. **Never give a canvas a size derived from its own layout width.** A full-screen canvas
   with no CSS size made `canvas.width = clientWidth * devicePixelRatio` grow every frame on
   any fractional device pixel ratio (Windows at 125% or 150% display scaling), exhausting
   GPU memory and killing the tab within seconds. Canvases get an explicit CSS size and an
   integer backing store. See `#confetti` in `css/styles.css` and `Confetti.frame`.

2. **`backdrop-filter` is banned.** On a full-screen or always-visible surface it forces a
   whole-viewport readback every frame: measured 60fps → 16-19fps, independent of blur
   radius. The glass look comes from layered translucency, inner highlights and shadows.
   Verify any change with an A/B frame-rate measurement before reintroducing it.

3. **The frame loop must never die.** `js/main.js` wraps the loop in try/catch, pauses the
   simulation on a tick error, skips render errors, and runs a 1-second watchdog that
   restarts a stalled loop and re-opens a decision dialog that was lost. A thrown error
   killing `requestAnimationFrame` looks exactly like a crash to a player.

4. **Saves must survive schema changes.** `Game.load()` repairs old saves: missing rivals,
   products, upgrade keys, NaN numbers, unknown pending events, renamed HQ departments,
   levels above a new maximum. When you change the economy in a way that adds a recurring
   cost, give existing saves a grace credit (see the `econ` marker and restructuring grant)
   rather than bankrupting them on load.

5. **Per-business books must reconcile.** The sum of each business's `net` minus head-office
   upkeep minus interest plus subsidiaries must equal the company's `lastDay.profit`
   exactly. The Ledger view shows both; a mismatch is a bug, not a rounding artifact.

## Where the difficulty lives

Profit is deliberately hard-won. Before changing any of these, read `docs/game-design.md`:
progressive corporate tax, corporate overhead that scales with business count, daily upkeep
on every upgrade level, wage inflation and staff turnover tied to company value, same-type
market saturation, reputation that drifts back to 50, a valuation multiple applied to
*after-tax* profit, 90-day loan terms with margin calls, a year-end levy, rivals that expand
into your sectors and run price wars, and a stock market with spreads, slumps and busts.
The two constants that decide the win rate more than any other are `ECONOMY.competition`
and the margin-call rules (`marginHeadroom`, `marginCashFloor`); the sim proved everything
else is survivable on its own.

## Persistent state

`market_mayhem_save_v1` is the run. `market_mayhem_meta_v1` is the Legacy: IPO count, points,
perks, recent runs and Daily Sprint bests. `Game.loadMeta()` / `Game.saveMeta()` own it, and
`Game.newGame({ meta, challenge })` applies perks and seeds the RNG for a sprint. All engine
randomness goes through `rand()`, never `Math.random`, so a seeded run stays reproducible.
