# Market Mayhem

**Turn $1,000 and a corner store into a $1,000,000,000 empire.**

Market Mayhem is a browser-based business simulation game written in plain HTML, CSS and JavaScript. No frameworks, no build step, no server, no accounts — open `index.html` and play.

## Play it

1. Clone or download this repository.
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).
3. Name your company, pick a difficulty, and start.

Progress autosaves to your browser's local storage every 5 days and whenever you leave the page. Come back later and hit **Continue** — your managers even keep the shops running for up to 20 days while you're away.

## Deploy to Vercel

The game is a static site, so Vercel needs no build step. `vercel.json` is already included.

**From the dashboard (recommended)**

1. Go to [vercel.com/new](https://vercel.com/new) and import the `market-mayhem` repository.
2. Leave **Framework Preset** as *Other* and the build command empty.
3. Click **Deploy**. Vercel serves `index.html` from the repository root.

Vercel deploys the repository's default branch to production. If the game lives on a feature branch, either merge it into the default branch first, or open the project's **Settings → Git → Production Branch** and set it to that branch. Every push after that redeploys automatically.

**From the command line**

```bash
npm i -g vercel
vercel login
vercel --prod
```

## How it works

| System | What it does |
| --- | --- |
| **Businesses** | 11 types across 7 tiers, from Corner Store to Aerospace Corp. Each sells 4 products, needs staff, pays rent, and builds reputation. Extra copies of the same type cost more and share customers. |
| **Supply & demand** | Every product has a live wholesale price driven by supply (bulk buying pushes it up, it recovers over time) and a drifting demand level. Your retail price versus the fair price sets how many customers buy. |
| **Staff & wages** | Employees serve a fixed number of customers a day. Pay above market for productivity and morale; understaffing costs sales and reputation. Market wages drift up as your company grows. |
| **Running costs** | Nothing is free. You pay wages, rent, **corporate overhead** that scales with how many businesses you own, **daily upkeep** on every upgrade level, loan interest, and **progressive corporate tax** on profit. Losses carry forward against future tax. |
| **Ledger** | A per-business profit and loss statement for yesterday: revenue, goods, wages, fixed costs, overhead, upkeep, tax share, net, margin and return on invested capital. Sortable, and the rows reconcile exactly to the company total. |
| **Bank** | Credit grows with net assets. Interest accrues daily and rises with utilization. Negative cash starts a 10-day overdraft countdown to **bankruptcy**. |
| **Market events** | 30+ random events — heatwaves, recessions, viral trends, supply-chain crises, strikes, market crashes — plus decision events with real trade-offs. |
| **Company valuation** | Net assets plus goodwill (a multiple of average daily profit, scaled by growth momentum and investor sentiment). It jitters like a stock and has a share price. Reach **$1B** to win. |
| **Rivals** | Eight AI companies grow, taunt you, steal customers and crash in downturns. Overtake them on the leaderboard, trade their shares, or acquire them outright. |
| **Upgrades** | Twelve per-business upgrades in four branches (Capacity, Operations, Experience, Growth) and fifteen HQ upgrades across five departments (Supply Chain, Growth, People, Finance, Intelligence). Later tiers unlock behind earlier ones, and every level adds daily upkeep, so an upgrade is only worth buying if it earns more than it costs to keep. |
| **Quests & achievements** | Rotating objectives and 25 achievements with cash rewards keep every session moving. |

## Controls

| Key | Action |
| --- | --- |
| `Space` | Pause / resume |
| `1` `2` `3` `4` | 1× / 2× / 4× / 8× speed |
| `D` `B` `L` `M` `K` `H` `R` | Dashboard, Businesses, Ledger, Market, Bank, HQ, Rivals |
| `Esc` | Close dialogs |

## Project layout

```
index.html        page shell
css/styles.css    liquid-glass design system, layout, animations, embedded fonts
fonts/            Outfit + Plus Jakarta Sans (also inlined into the stylesheet)
js/data.js        products, business types, upgrades, events, rivals, quests, achievements
js/engine.js      simulation engine (runs headlessly in Node too)
js/icons.js       inline SVG icon set
js/charts.js      dependency-free canvas charts
js/ui.js          views, bindings, toasts, modals, sound, confetti
js/main.js        game loop, start screen, keyboard, persistence
```

## Look and feel

A dark "liquid glass" interface: translucent layered panels, soft inner highlights and
deep shadows over a slow colour-washed background. Type is **Outfit** for display text
and numerals and **Plus Jakarta Sans** for interface text, both embedded in the
stylesheet so nothing is fetched at runtime. Interface icons are inline SVG from
[Lucide](https://lucide.dev) (ISC); emoji appear only as game content, seated in tiles.

Everything is composited cheaply on purpose. `backdrop-filter` is deliberately unused:
on a full-screen or always-visible surface it forced a whole-viewport readback every
frame and cost about 40 fps, while blurring only a smooth gradient. Layered
translucency and inner highlights give the same look and hold 60 fps with 30 businesses
running at 8x speed.

## Credits

- Icons: [Lucide](https://lucide.dev) — ISC License
- Fonts: Outfit and Plus Jakarta Sans — SIL Open Font License 1.1 (see `fonts/README.md`)

The engine has no DOM dependencies, so you can balance-test it from Node:

```js
const { Game } = require('./js/engine.js');
const g = new Game();
g.newGame({ company: 'Test Co.', difficulty: 'normal' });
for (let i = 0; i < 100; i++) g.tick();
console.log(g.S.valuation);
```

