# Game design and economy

Every number here lives in `js/data.js` unless noted. The engine reads them; nothing is
hard-coded in the UI.

## The goal

Start with **$1,000** and one Corner Store. Reach **$1,000,000,000** in company value.
Go bankrupt if cash stays negative for 10 consecutive days.

A day is one simulation tick, one second of real time at 1x speed. A competent player
should need roughly **1,400-1,800 days**, and should lose a run now and then.

Winning is not the end. **Go Public** floats the company: the run is recorded to the
Legacy, you earn points for permanent perks, and the next run's target doubles while tax
and rivals get tougher (`PRESTIGE`). The **Daily Sprint** is a seeded 180-day run, the same
markets and events for everyone on that date, scored on final company value (`DAILY`).

## The daily tick

`Game.tick()` runs this order, and the order matters:

1. Auto-pricing and auto-restock, per business (auto-restock may draw supplier credit).
2. Each business trades: demand, service, sales, spoilage, staff turnover, reputation.
3. Loan interest, loan amortisation, margin calls, subsidiary income, head-office upkeep.
4. Corporate tax on the company total, then allocated back to businesses.
5. Wholesale market drift.
6. Random events resolve and expire.
7. Rivals grow, slump, crash, expand, wage price wars, and bid for you; ranking updates.
8. Streak, valuation, year-end levy and annual report, close-call check, history.
9. Timed offers expire and spawn, unlocks, quests, achievements.
10. Overdraft and bankruptcy checks; sprint end; win check.

## Demand

Units demanded for one product at one business, per day:

```
demand = traffic
       × product weight
       × (1 + business traffic upgrades + HQ traffic upgrades)
       × saturation(type)
       × reputation factor
       × marketing factor
       × competition factor
       × price-war factor
       × difficulty demand
       × season × market demand drift × (1 + business demand upgrades)
       × price factor
```

- **Reputation factor** `0.6 + 0.8 × rep/100`. Reputation **drifts back toward 50**: above
  50 it decays a little every day and is only earned back (+0.4) on days with full shelves,
  service at 92%+ and prices no more than 15% over fair. Stockouts, understaffing, gouging
  past 1.15× fair and price wars push it down. Upgrades can set a floor.
- **Price factor** `(price / fairPrice) ^ -elasticity`, softened by Premium Fit-out,
  Membership Tiers and the Brand Studio.
- **Saturation** `0.86 ^ (copies of this type − 1)`, softened by the Franchise Program.
- **Competition** `1 / (1 + 0.105 × Σ rival strength in this sector)`. Rivals expand into
  the sector you own most of once you have five businesses, so pressure grows with you.
- **Price war**: a rival in your sector cuts prices for 12-25 days. Any product priced
  above 0.97× fair loses 22% of its traffic; match fair prices and you keep them.
- **Season**: the 360-day year has four quarters that tilt demand by category. Q4 also
  raises wholesale costs 8%.
- **Service**: staff throughput caps how many customers are served. New hires are
  trainees for 5 days at 70% speed; the staffing recommendation accounts for that.

## Costs

This is where the difficulty lives. Revenue minus cost of goods is only the beginning.

| Cost | Formula |
| --- | --- |
| **Wages** | `base wage × wage level × (1 + HQ + business wage effects) × wage index` |
| **Wage index** | `1 + 0.14·L + 0.012·L²` with `L = log10(valuation / 20000)`; about 1.9x at $1B. Benefits Package softens it |
| **Turnover** | each employee quits with probability `0.004 × (1.35 − wage level)` per day. Pay 135% of market and nobody leaves |
| **Rent** | fixed per business type |
| **Marketing** | whatever you set, with diminishing returns |
| **Spoilage** | 4.5% of perishable stock per day, cut 45% per Cold Chain level |
| **Corporate overhead** | `rent × (0.30 + 0.026 × (businesses − 1))`, capped at `1.15 × rent`, reduced by the Operations Centre |
| **Upgrade upkeep** | every purchased level bills a fixed share of its own price, every day, forever |
| **Interest** | `0.001 × difficulty × (1 + credit utilisation)` per day, reduced by Treasury; +0.1%/day of all debt while in breach of the credit line |
| **Year-end levy** | 3% of company value on day 360 of every year |
| **Corporate tax** | progressive, below; ×(1 + 0.04 per IPO) |

**Corporate tax** is charged daily on profit before tax. The bracket is chosen by the
**30-day average** profit:

| 30-day average profit / day | Rate |
| --- | --- |
| up to $450 | 0% |
| up to $6,000 | 12% |
| up to $80,000 | 20% |
| up to $1,500,000 | 28% |
| above | 35% |

Tax Strategy cuts 4 percentage points per level. Difficulty scales the whole rate.
**Losses carry forward**.

## Valuation

```
valuation = (net assets + goodwill) × jitter
net assets = cash + inventory + 0.6 × what you paid for businesses
           + 0.4 × upgrades + subsidiaries × health + share portfolio − debt
goodwill   = 30-day average after-tax profit × multiple
multiple   = 55 × sentiment × (1 + 0.5 × growth) × (1 + Investor Relations) × streak bonus
```

Sentiment is a mean-reverting random walk pushed by events and can fall as low as 0.35 in
a panic. Growth compares the 7-day and 30-day averages, clamped to ±60%. The **streak
bonus** is `1 + min(0.2, streak / 150)`: every consecutive profitable day lifts the
multiple, and a loss day after a 10+ day streak knocks 0.03 off sentiment.

## Money supply

- **Credit limit**: `2,500 + 0.75 × tangible net assets + goodwill part`, where shares
  count at 50% and the goodwill part is capped at 60% of tangible assets. Widened 12% per
  Treasury level, 15% per Investor Network perk, shrunk 20% by a Credit Crunch.
- **Loans** are interest-only for **90 days**, then the bank collects the principal in
  30 equal daily instalments. Refinance for a 1% fee to reset the term. Up to 5 loans.
- **Supplier credit**: if auto-restock is on and cash runs short, the bank fronts the
  stock as a loan (same terms). Empty shelves are the fastest way to die.
- **Margin call**: debt above 1.3× the credit line for 3 days. The bank takes cash above
  three days of fixed costs, charges the penalty rate, lends nothing, and after 30 more
  days in breach sells your weakest business.
- **Overdraft**: negative cash charges 1% of the balance daily and starts the 10-day
  countdown.
- **Close call**: three or more days with under 2 days of runway, then back above 5,
  pays 2% of company value.
- **Quests** and **achievements** pay modest one-off cash.

## Timed offers

Up to two at a time, roughly one every 33 days, they do not pause the game and vanish
when their countdown ends (`OFFER_TEMPLATES`):

| Offer | Window | What it is |
| --- | --- | --- |
| Distressed sale | 5 days | A business at 45-62% of its price, reputation 30, empty shelves |
| Bulk lot | 2 days | 6-12 days of one product at 40% under wholesale, storage permitting |
| Block trade | 3 days | A rival's shares at 25% off, minimum ticket 5% of your value |
| Star manager | 4 days | +15% throughput and productivity at one business, permanently |

Coming back after time away always leaves one offer waiting.

## Rivals

Eight AI companies. They compound daily with noise (base growth × 0.85), slump for 20-60
days at a time, crash 30-60% on scandals and, if they fall below 15% of their starting
value, collapse (your shares go to zero). Omnicorp cannot collapse. They compete in their
sectors, expand into yours, run price wars, taunt you, and any rival worth at least twice
your company may make a **hostile bid** at 1.3× your value: sell out (a win worth one
Legacy point less) or fight through a 30-day raid.

Shares trade at a **3% bid-ask spread**. Acquisitions cost **2× value** once you are worth
1.5× theirs; the subsidiary costs 0.15% of its value per day for 60 days of integration,
then pays 0.3% per day scaled by a health that decays 0.4% per day unless you reinvest 5%
of its value.

## Businesses, upgrades, market, events

Unchanged in shape from the first economy: 11 business types across 7 tiers, 12 upgrades
per business in four branches, 15 HQ upgrades in five departments, a live wholesale price
per product, and 36 events (7 decisions). See `js/data.js`. New events: Credit Crunch
(interest ×3, credit line −20%), Talent Raid (a third of one store's staff leave), and the
engine-triggered Hostile Takeover Bid.

## Difficulty

| | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Tax rate | 0.75x | 1.0x | 1.2x |
| Overhead | 0.8x | 1.0x | 1.25x |
| Loan interest | 0.8x | 1.0x | 1.3x |
| Bad events, price wars | 0.7x | 1.0x | 1.3x |
| Rival growth, expansion | 0.8x | 1.0x | 1.25x |
| Demand | 1.1x | 1.0x | 0.9x |

## Balance targets

Run `node tools/sim.js 8`. On Normal the auto-player should land near:

| Metric | Target |
| --- | --- |
| Days to $1B | 1,400-1,800 median |
| Net margin at the end | 30-40% |
| Businesses owned | 45-60 |
| Wins out of 8 | 5 to 7 |

The auto-player is deliberately unsophisticated: it matches price wars, gives raises,
refinances loans that are about to term, saves for the levy and takes distressed sales,
but it over-leverages and never sells a loser. Its deaths are over-leveraged companies
hit by a raid or a recession, which is the intended way to lose. A human should beat it.
If a change moves these, it changed the difficulty; treat that as the headline of the
change, not a side effect.
