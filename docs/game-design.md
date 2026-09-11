# Game design and economy

Every number here lives in `js/data.js` unless noted. The engine reads them; nothing is
hard-coded in the UI.

## The goal

Start with **$1,000** and one Corner Store. Reach **$1,000,000,000** in company value.
Go bankrupt if cash stays negative for 10 consecutive days.

A day is one simulation tick, one second of real time at 1x speed. A competent player
should need roughly **1,200-1,500 days**.

## The daily tick

`Game.tick()` runs this order, and the order matters:

1. Auto-pricing and auto-restock, per business.
2. Each business trades: demand, service, sales, spoilage, reputation.
3. Loan interest, subsidiary income, head-office upkeep.
4. Corporate tax on the company total, then allocated back to businesses.
5. Wholesale market drift.
6. Random events resolve and expire.
7. Rivals grow; ranking updates.
8. Valuation, history, unlocks, quests, achievements.
9. Overdraft and bankruptcy checks; win check.

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
       × difficulty demand
       × market demand drift × (1 + business demand upgrades)
       × price factor
```

- **Reputation factor** `0.6 + 0.8 × rep/100`, so reputation roughly doubles traffic across
  its range. Stockouts and understaffing push it down, a full shelf pushes it up, and
  upgrades can set a floor.
- **Price factor** `(price / fairPrice) ^ -elasticity`. Elasticity is per product and is
  reduced by Premium Fit-out, Membership Tiers and the HQ Brand Studio. Fair price is
  `wholesale × markup`.
- **Saturation** `0.86 ^ (copies of this type − 1)`, softened by the Franchise Program.
  The fifth Coffee Shop serves far fewer customers than the first.
- **Competition** `1 / (1 + 0.09 × Σ rival strength in this sector)`.
- **Service**: staff throughput caps how many customers are actually served. Unserved
  demand is lost revenue *and* lost reputation.

## Costs

This is where the difficulty lives. Revenue minus cost of goods is only the beginning.

| Cost | Formula |
| --- | --- |
| **Wages** | `base wage × wage level × (1 + HQ + business wage effects) × wage index` |
| **Wage index** | `1 + 0.075 × log10(valuation / 20000)`, softened by the Benefits Package. Talent gets pricier as you grow |
| **Rent** | fixed per business type |
| **Marketing** | whatever you set, with diminishing returns |
| **Spoilage** | 4.5% of perishable stock per day, cut 45% per Cold Chain level |
| **Corporate overhead** | `rent × (0.30 + 0.026 × (businesses − 1))`, capped at `1.15 × rent`, reduced by the HQ Operations Centre |
| **Upgrade upkeep** | every purchased level bills a fixed share of its own price, every day, forever |
| **Interest** | `0.001 × difficulty × (1 + credit utilisation)` per day, reduced by Treasury |
| **Corporate tax** | progressive, below |

**Corporate tax** is charged daily on profit before tax. The bracket is chosen by the
**30-day average** profit, so one exceptional day cannot spike the rate:

| 30-day average profit / day | Rate |
| --- | --- |
| up to $450 | 0% |
| up to $6,000 | 12% |
| up to $80,000 | 20% |
| up to $1,500,000 | 28% |
| above | 35% |

Tax Strategy cuts 4 percentage points per level. Difficulty scales the whole rate
(easy 0.75x, hard 1.2x). **Losses carry forward**: a negative day accumulates in
`taxLossCarry` and shelters future taxable profit.

## Valuation

```
valuation = (net assets + goodwill) × jitter
net assets = cash + inventory + 0.6 × what you paid for businesses
           + 0.4 × upgrades + subsidiaries + share portfolio − debt
goodwill   = 30-day average after-tax profit × multiple
multiple   = 95 × sentiment × (1 + 0.5 × growth) × (1 + Investor Relations) × streak bonus
```

Sentiment is a mean-reverting random walk pushed by events. Growth compares the 7-day and
30-day profit averages. The result jitters like a share price and divides into 1,000,000
shares.

Because goodwill is built on **after-tax** profit, every cost above compounds into the
valuation, which is why the cost stack sets the pace of the whole game.

## Businesses

Eleven types across seven tiers. Each sells four products and unlocks at a company value.
Each additional copy of the same type costs **1.40x** more and eats into the others'
customers.

| Tier | Type | Price |
| --- | --- | --- |
| 1 | Corner Store | $3,000 |
| 1 | Coffee Shop | $8,000 |
| 2 | Fashion Boutique | $40,000 |
| 2 | Electronics Store | $50,000 |
| 3 | Restaurant | $140,000 |
| 3 | Supermarket | $250,000 |
| 4 | Car Dealership | $1,100,000 |
| 5 | Tech Startup | $4,500,000 |
| 5 | Factory | $18,000,000 |
| 6 | Pharma Lab | $60,000,000 |
| 7 | Aerospace Corp | $220,000,000 |

## Upgrades

Twelve per business in four branches, fifteen at HQ in five departments. Later tiers are
gated behind earlier ones. **Every level adds permanent daily upkeep**, so an upgrade is
only worth buying if its effect beats its rent.

Per business:

| Branch | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| Capacity | Stock Room | Cold Chain | Distribution Hub |
| Operations | Self-Checkout | Staff Training | Robotics Line |
| Experience | Renovation | Premium Fit-out | Flagship Store |
| Growth | Loyalty Program | Membership Tiers | Brand Ambassadors |

HQ:

| Department | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| Supply Chain | Procurement Team | Regional Warehouses | Freight Network |
| Growth | Marketing Agency | Brand Studio | Franchise Program |
| People | HR Department | Corporate Academy | Benefits Package |
| Finance | Treasury Desk | Tax Strategy | Investor Relations |
| Intelligence | Analytics Suite | Legal Team | Operations Centre |

Effects are declarative. An upgrade declares `fx: { traffic: 0.07 }` and the engine sums it
per level through `bizEff` / `hqEff`. Effect keys in use: `capacityDays`, `spoilMult`,
`buyCost`, `throughput`, `productivity`, `wages`, `traffic`, `priceSens`, `demand`,
`marketing`, `repFloor`, `supplyImpact`, `wageInflation`, `bizCost`, `saturation`,
`interest`, `credit`, `taxCut`, `multiple`, `overhead`.

## Market

Every product has a live wholesale price:

```
cost = base cost × supply^-0.6 × event cost multipliers × noise
```

Supply falls when you buy in bulk and recovers toward 1 over time, so large orders move the
price against you. The Freight Network reduces that impact by 40% per level. Demand drifts
on its own random walk.

## Money supply

- **Credit limit**: `2,500 + 0.75 × net assets + 0.22 × goodwill`, up to 5 loans, widened
  12% per Treasury level.
- **Overdraft**: negative cash charges 1% of the balance daily and starts a 10-day
  countdown to bankruptcy.
- **Quests**: reward scales at ~0.6% of company value, deliberately small. They were once
  out-earning the businesses.
- **Achievements**: one-off bonuses, also deliberately modest.

## Events

33 events, 6 of which are decisions that pause the game. They shift demand by category,
business or product, wholesale costs, wages, productivity, interest rates, competition,
investor sentiment, and sometimes take cash or stock directly. At most 3 run at once. The
Legal Team softens negative events by 35%.

## Rivals

Eight AI companies from Corner King ($40K) to Omnicorp ($300M). They compound daily with
noise, crash in downturns, compete in their sectors and taunt you when ahead. You can trade
their shares, overtake them on the leaderboard, or acquire them outright at 125% of value
once you are worth 1.5x theirs. An acquired rival becomes a subsidiary paying 0.4% of its
value per day.

## Difficulty

| | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Tax rate | 0.75x | 1.0x | 1.2x |
| Overhead | 0.8x | 1.0x | 1.25x |
| Loan interest | 0.8x | 1.0x | 1.3x |
| Bad events | 0.7x | 1.0x | 1.3x |
| Rival growth | 0.8x | 1.0x | 1.25x |
| Demand | 1.1x | 1.0x | 0.9x |

## Balance targets

Run `node tools/sim.js 6`. On Normal the auto-player should land near:

| Metric | Target |
| --- | --- |
| Days to $1B | 1,200-1,500 median |
| Net margin at the end | 25-45% |
| Businesses owned | 35-50 |
| Wins out of 6 | 5 or 6 |

The auto-player is deliberately unsophisticated, so a human should beat it. If a change
moves these, it changed the difficulty; treat that as the headline of the change, not a
side effect.
