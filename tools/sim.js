// =============================================================================
// Headless balance harness.
//
//   node tools/sim.js [runs]      default 4
//
// Plays the game with a deliberately unsophisticated auto-player: keeps shelves
// stocked, staffs to the recommendation, prices at the suggestion, buys upgrades
// whose upkeep looks affordable, expands into the richest type it can fund, and
// repays debt when flush. A human should comfortably beat it.
//
// On Normal it should win in roughly 1200-1500 days at 25-45% net margin. If a
// change moves that, the change altered the game's difficulty.
// =============================================================================
const path = require('path').join(__dirname, '..', 'js') + require('path').sep;
const D = require(path + 'data.js');
const { Game } = require(path + 'engine.js');
const { BUSINESS_TYPES, TYPE_ORDER, HQ_UPGRADES, UPGRADES, PRODUCTS } = D;

function run(label, maxDays = 4000, opts = {}) {
  const g = new Game();
  const counts = { events: 0, choices: 0, achievements: 0, quests: 0, unlocks: 0 };
  g.on(t => { if (counts[t + 's'] !== undefined) counts[t + 's']++; });
  g.newGame({ company: 'SimCo', difficulty: opts.difficulty || 'normal' });
  const S = g.S;
  const milestones = [1e4, 1e5, 1e6, 1e7, 1e8, 1e9];
  const reached = {};
  let peakTax = 0, peakOverhead = 0, maxMargin = 0;

  for (let d = 0; d < maxDays; d++) {
    if (S.events.pending) {
      const fee = S.events.pending.param.fee || 0, id = S.events.pending.id;
      const accept = id === 'buyout' ? false : id === 'recall' ? true : id === 'union' ? true : S.cash > fee * 5;
      g.resolveChoice(accept ? 0 : 1);
    }
    for (const b of S.businesses) {
      b.autoRestock = true; b.stockDays = 4;
      const rec = g.recommendedStaff(b);
      if (b.staff < rec) g.hire(b.id, rec - b.staff);
      else if (b.staff > rec + 1) g.fire(b.id, b.staff - rec);
      g.applySuggestedPrices(b.id);
      const T = BUSINESS_TYPES[b.type];
      if (g.bizProfitEstimate(b) > T.rent * 3) g.setMarketing(b.id, T.rent * 1.5);
      // upgrades: only when the daily benefit plausibly beats the daily upkeep,
      // approximated by "this business earns well and the upgrade is small vs cash"
      if (d % 4 === 0) {
        for (const uid in UPGRADES) {
          if (g.upgradeLock(b, uid)) continue;
          const c = g.upgradeCost(b, uid);
          if (c === null) continue;
          const upkeepAfter = g.bizUpkeep(b) + c * UPGRADES[uid].upkeep;
          if (c < S.cash * 0.06 && upkeepAfter < Math.max(20, g.bizProfitEstimate(b) * 0.35)) g.buyUpgrade(b.id, uid);
        }
      }
    }
    for (const id in HQ_UPGRADES) {
      if (g.hqLock(id)) continue;
      const c = g.hqCost(id);
      if (c !== null && c < S.cash * 0.08 && g.hqUpkeep() + c * HQ_UPGRADES[id].upkeep < Math.max(50, S.ema30 * 0.3)) g.buyHqUpgrade(id);
    }
    // expansion: richest affordable type, keeping a reserve
    const reserve = g._dailyFixedCosts(g.activeEffects()) * 8;
    let best = null;
    for (const t of TYPE_ORDER) {
      if (!S.unlocked[t]) continue;
      const cost = g.bizCost(t);
      const invNeed = BUSINESS_TYPES[t].products.reduce((a, pid) => a + g.buyCost(pid) * BUSINESS_TYPES[t].traffic * PRODUCTS[pid].weight * 4, 0);
      if (S.cash + g.availableCredit() * 0.7 >= cost + invNeed + reserve) best = { t, cost, total: cost + invNeed + reserve };
    }
    if (best) {
      if (S.cash < best.total) { const need = Math.ceil(best.total - S.cash); if (need <= g.availableCredit() && S.loans.length < 5) g.takeLoan(need); }
      if (S.cash >= best.cost + reserve) g.buyBusiness(best.t);
    }
    if (S.loans.length && S.cash > g.totalDebt() * 3 + reserve) for (const l of [...S.loans]) g.repayLoan(l.id, l.amount);

    g.tick();
    peakTax = Math.max(peakTax, S.lastDay.tax);
    peakOverhead = Math.max(peakOverhead, S.lastDay.overhead + S.lastDay.upkeep + S.lastDay.hqUpkeep);
    if (S.lastDay.revenue > 0) maxMargin = Math.max(maxMargin, S.lastDay.profit / S.lastDay.revenue);
    for (const m of milestones) if (!reached[m] && S.valuation >= m) reached[m] = S.day;
    if (S.flags.bankrupt || S.flags.won) break;
  }
  const L = S.lastDay;
  return { label, day: S.day, won: S.flags.won, bankrupt: S.flags.bankrupt, val: S.valuation, cash: S.cash, biz: S.businesses.length,
    rank: S.rank, reached, taxPaid: S.stats.taxPaid, margin: L.revenue > 0 ? L.profit / L.revenue : 0,
    costs: { rev: L.revenue, cogs: L.cogs, wages: L.wages, rent: L.rent, oh: L.overhead, up: L.upkeep + L.hqUpkeep, tax: L.tax }, counts };
}

const N = +(process.argv[2] || 4);
const fmt = n => n >= 1e9 ? (n/1e9).toFixed(2)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : n.toFixed(0);
const days = [];
for (let i = 0; i < N; i++) {
  const r = run('run' + i);
  days.push(r.won ? r.day : null);
  console.log(`${r.label}: day ${String(r.day).padStart(4)} won=${r.won?'Y':'N'}${r.bankrupt?' BANKRUPT':''} val=${fmt(r.val)} biz=${r.biz} rank=${r.rank} margin=${(r.margin*100).toFixed(1)}% tax=${fmt(r.taxPaid)}`);
  console.log('   milestones:', Object.entries(r.reached).map(([k,v])=>fmt(+k)+'@d'+v).join(' '));
  console.log('   last day:', Object.entries(r.costs).map(([k,v])=>k+'='+fmt(v)).join(' '));
}
const ok = days.filter(Boolean);
if (ok.length) console.log(`\nwins ${ok.length}/${N}  median day ${ok.sort((a,b)=>a-b)[Math.floor(ok.length/2)]}  range ${Math.min(...ok)}-${Math.max(...ok)}`);
