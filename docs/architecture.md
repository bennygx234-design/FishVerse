# Architecture

Six scripts loaded in order, each attaching one global. No modules, no bundler, because the
game must run from a `file://` path with no tooling.

```
data.js   → window.MM_DATA      tuning data only, no behaviour
icons.js  → window.MM_ICONS     icon(name, size) → inline SVG string
engine.js → window.MM_ENGINE    the simulation. No DOM anywhere in this file
charts.js → window.MM_CHARTS    canvas drawing
ui.js     → window.MM_UI        everything that touches the DOM
main.js   → window.MM           boot, loop, persistence
```

`engine.js` also supports CommonJS, which is what lets `tools/sim.js` and any Node test
require it directly.

## The loop

`main.js` owns a single `requestAnimationFrame` loop with a fixed day interval
(1000ms ÷ speed) and an accumulator, capped at 16 catch-up ticks per frame so a backgrounded
tab cannot stampede on return.

```
loop(now)
  ├─ while accumulated time ≥ interval: game.tick()
  │     └─ stops early on a pending decision, bankruptcy or the win
  └─ UI.frame(now)
        ├─ Confetti.frame()          every frame
        ├─ UI.render()               throttled to 5/second
        └─ UI.drawCharts()           only when the day changed
```

Three layers of protection, each of which fixed a real "the game froze" report:

- A tick error pauses the simulation, surfaces a toast, and records the stack to
  `localStorage` under `mm_errors`.
- A render error is skipped; the loop continues.
- A 1-second watchdog restarts a loop that has not run for 3 seconds, and re-opens a
  decision dialog that was replaced by another modal (which previously stalled the game
  forever, since `tick()` refuses to run while a decision is pending).

## Engine state

One plain object, `game.S`, fully serialisable:

```
S = {
  version, econ, company, difficulty, day, cash,
  businesses[]      per business: type, staff, wages, marketing, prices, stock, avgCost,
                    upgrades, rep, autoRestock, autoPrice, last{}, history[]
  market{}          per product: cost, supply, demand, history[]
  loans[], hq{}, portfolio{}, subsidiaries[], competitors[],
  events{ active[], pending }, eventLog[], quests[], achievements{}, unlocked{},
  history{ valuation, cash, revenue, profit, debt, rank },
  stats{}, flags{ won, bankrupt, continued }, lastDay{}, taxLossCarry,
  sentiment, jitter, valuation, sharePrice, netAssets, goodwill, multiple, ema7, ema30,
  streak, overdraftDays, rank
}
```

`business.last` is yesterday's books: `revenue, cogs, wages, rent, marketing, overhead,
upkeep, spoiled, pretax, tax, net` plus per-product `sold` and `expected`. The Ledger view
reads exactly these fields, which is why the rows reconcile to the company total.

## Events out of the engine

The engine never touches the DOM. It emits, and `ui.js` subscribes:

`log, day, event, eventEnd, choice, choiceResolved, unlock, achievement, quest, rankUp,
taunt, bigSale, overdraft, overdraftWarning, bankrupt, win, bizBought, bizSold, acquired,
upgrade, hqUpgrade, loan`

A listener that throws is caught and logged; a broken UI cannot break the simulation.

## Rendering

Rebuilding the whole view 5 times a second would thrash the DOM, so the UI splits it:

- `UI.computeStructKey()` builds a signature from everything that changes the *shape* of a
  view: current view, selected business, counts, upgrade levels, loan ids, active events,
  sort order. When the key changes, the view's HTML is rebuilt.
- Otherwise a `refresh<View>()` function writes values into existing nodes addressed by
  `data-f` attributes, using `setText` / `setHtml` helpers that skip the write when the
  value is unchanged.

Numbers tween through `tweenNumber`, charts redraw only when the day changes, and
sparklines redraw once per day.

State that should force a rebuild must be added to the struct key. That is the single
easiest thing to get wrong when adding a view.

## Persistence

`localStorage` under `market_mayhem_save_v1`. Autosave every 5 days, on visibility change
and on unload. On load the game replays up to 20 missed days offline, capped and stopped if
cash goes negative, and spawns one timed offer so there is a decision waiting.

The Legacy (IPO count, points, perks, recent runs, Daily Sprint bests) lives separately
under `market_mayhem_meta_v1` and survives new games. `main.js` loads it once, passes it to
`Game.newGame({ meta })` so perks apply, and hands it to the UI through hooks (`meta`,
`buyPerk`, `goPublic`, `recordRun`).

`Game.load()` is defensive by design, because save files outlive schema changes. It:

- rejects a save that is not an object with businesses and a market
- rebuilds the rival list from the current definitions, keeping known ones
- maps renamed HQ departments (`logistics` → `procurement`)
- drops upgrade keys that no longer exist and clamps levels above a new maximum
- fills in products, fields and numbers that are missing or NaN
- drops a pending event the current build does not define
- on an economy change (`econ` marker), credits a restructuring grant so a company built
  under the old rules is not bankrupted by new recurring costs on first load

## Charts

`charts.js` draws three things on 2D canvas: `spark` (no axes), `line` (axes, gradient fill,
log option, hover crosshair) and `bars` (grouped, signed, rounded caps). Device pixel ratio
is capped at 2. The "glow" on a line is a second wider stroke at low alpha, not
`shadowBlur`, which is dramatically cheaper.

## Design system

See `docs/design-system.md`. The short version: everything is in `css/styles.css`, both
fonts are embedded as base64 so `file://` works, interface icons are inline SVG, and
`backdrop-filter` is banned for measured performance reasons.
