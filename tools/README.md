# tools

## sim.js — balance harness

```bash
node tools/sim.js        # 4 runs
node tools/sim.js 8      # 8 runs
```

Plays complete games headlessly against `js/engine.js`, which has no DOM dependency. Prints
for each run: days to win, final valuation, business count, market rank, net margin, total
tax paid, the day each 10x valuation milestone was reached, and yesterday's cost breakdown.

The auto-player is intentionally basic — restock, staff to the recommendation, price at the
suggestion, buy upgrades that look affordable, expand into the richest type it can fund,
repay debt when flush. It is a floor, not a ceiling: a human should beat it.

**Expected on Normal:** median 1,200-1,500 days, 25-45% net margin, 35-50 businesses, 5 or
6 wins out of 6. A change that moves this band changed the game's difficulty. See
`docs/game-design.md`.
