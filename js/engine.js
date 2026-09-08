/* =========================================================================
   MARKET MAYHEM — simulation engine (no DOM; also runs in Node for testing)
   ========================================================================= */
(function (root) {
  'use strict';
  const D = root.MM_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  const { PRODUCTS, BUSINESS_TYPES, TYPE_ORDER, UPGRADES, HQ_UPGRADES, COMPETITORS, EVENTS, QUEST_TEMPLATES, ACHIEVEMENTS, DIFFICULTY } = D;

  // ---------- helpers ---------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function gauss() { // standard normal (Box-Muller)
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const stochRound = x => { const f = Math.floor(x); return f + (Math.random() < x - f ? 1 : 0); };
  function niceRound(x) { // round to a "nice" number for targets: 1, 2, 2.5, 5 x 10^n
    if (x <= 0) return 0;
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    const m = x / p;
    const nice = m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10;
    return nice * p;
  }
  function roundPrice(p) {
    if (p < 10) return Math.round(p * 100) / 100;
    if (p < 100) return Math.round(p * 10) / 10;
    if (p < 10000) return Math.round(p);
    return Math.round(p / 100) * 100;
  }
  function weightedPick(items, wfn) {
    let total = 0; for (const it of items) total += wfn(it);
    let r = Math.random() * total;
    for (const it of items) { r -= wfn(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }

  const SAVE_KEY = 'market_mayhem_save_v1';
  const MAX_ACTIVE_EVENTS = 3;
  const MAX_LOANS = 5;
  const BASE_RATE = 0.001;        // 0.1% per day
  const OVERDRAFT_LIMIT_DAYS = 10;
  const HIST_MAX = 400;

  class Game {
    constructor() {
      this.S = null;
      this.listeners = [];
      this._rankCache = null;
    }

    // ---------- event bus -----------------------------------------------------
    on(fn) { this.listeners.push(fn); }
    emit(type, payload = {}) {
      for (const fn of this.listeners) { try { fn(type, payload, this); } catch (e) { /* UI errors must not break the sim */ if (root.console) console.error(e); } }
    }
    log(icon, text, kind = 'info') {
      const S = this.S;
      S.eventLog.unshift({ day: S.day, icon, text, kind });
      if (S.eventLog.length > 80) S.eventLog.length = 80;
      this.emit('log', { icon, text, kind });
    }

    // ---------- new game --------------------------------------------------------
    newGame({ company = 'Pixel & Co.', difficulty = 'normal' } = {}) {
      const market = {};
      for (const pid in PRODUCTS) {
        const p = PRODUCTS[pid];
        market[pid] = { cost: p.cost * rnd(0.92, 1.08), supply: rnd(0.95, 1.05), demand: rnd(0.9, 1.1), history: [] };
      }
      const S = this.S = {
        version: 1,
        company, difficulty,
        day: 0,
        cash: D.START_CASH,
        businesses: [],
        nextBizId: 1,
        market,
        loans: [], nextLoanId: 1,
        hq: {},
        events: { active: [], pending: null },
        eventLog: [],
        competitors: COMPETITORS.map(c => ({ id: c.id, value: c.value * rnd(0.8, 1.25), history: [], acquired: false, strength: 1, lastRank: 0 })),
        portfolio: {},
        subsidiaries: [],
        sentiment: 1.0,
        jitter: 0,
        valuation: 0, sharePrice: 0, netAssets: 0, goodwill: 0, multiple: 0,
        ema7: 0, ema30: 0,
        history: { valuation: [], cash: [], revenue: [], profit: [], debt: [], rank: [] },
        streak: 0, overdraftDays: 0,
        quests: [], questCooldown: 0,
        achievements: {},
        unlocked: {},
        stats: { unitsSold: 0, totalRevenue: 0, totalProfit: 0, loansTaken: 0, loansRepaid: 0, maxStaff: 0, recessionsSurvived: 0,
          rivalsBeaten: 0, reachedRank1: false, acquisitions: 0, biggestSale: 0, tradingProfit: 0, bestStreak: 0, questsDone: 0,
          upgradesBought: 0, eventsSeen: 0, unitsByProduct: {}, peakValue: 0, bizBought: 0 },
        flags: { won: false, bankrupt: false, tutorial: 0, continued: false },
        lastDay: { revenue: 0, cogs: 0, wages: 0, rent: 0, marketing: 0, interest: 0, other: 0, profit: 0, units: 0, subsidiaries: 0 },
        rank: 0,
        savedAt: Date.now(),
      };
      for (const k in HQ_UPGRADES) S.hq[k] = 0;
      for (const pid in market) market[pid].history.push(market[pid].cost);
      for (const c of S.competitors) c.history.push(c.value);
      // Starter store with two days of stock so day one already sells something.
      const biz = this._makeBusiness('corner', 0);
      for (const pid of BUSINESS_TYPES.corner.products) {
        const p = PRODUCTS[pid];
        const units = Math.ceil(BUSINESS_TYPES.corner.traffic * p.weight * 2);
        biz.stock[pid] = units;
        biz.avgCost[pid] = market[pid].cost;
      }
      S.businesses.push(biz);
      for (const t in BUSINESS_TYPES) if (BUSINESS_TYPES[t].unlock <= 0) S.unlocked[t] = true;
      this._computeValuation();
      this._pushHistory();
      while (S.quests.length < 3) { const q = this._generateQuest(); if (!q) break; S.quests.push(q); }
      this.log('🏪', `${company} opens its first Corner Store with $1,000.`, 'good');
      return S;
    }

    _makeBusiness(type, paid) {
      const T = BUSINESS_TYPES[type];
      const S = this.S;
      const count = S.businesses.filter(b => b.type === type).length;
      const biz = {
        id: S.nextBizId++, type, name: count ? `${T.name} #${count + 1}` : T.name,
        paid, upgradesPaid: 0,
        staff: T.staff, wageMult: 1.0, marketing: 0, rep: 50,
        autoRestock: false, stockDays: 4, autoPrice: false,
        stock: {}, avgCost: {}, prices: {}, upgrades: {},
        last: { revenue: 0, cogs: 0, wages: 0, rent: 0, marketing: 0, profit: 0, sold: {}, expected: {}, lostStock: 0, lostStaff: 0, serviceRatio: 1, units: 0, spoiled: 0 },
        history: [],
        boughtDay: S.day,
      };
      for (const uid in UPGRADES) biz.upgrades[uid] = 0;
      for (const pid of T.products) {
        biz.stock[pid] = 0; biz.avgCost[pid] = S.market[pid].cost;
        biz.prices[pid] = roundPrice(this.fairPrice(pid));
        biz.last.sold[pid] = 0; biz.last.expected[pid] = T.traffic * PRODUCTS[pid].weight;
      }
      return biz;
    }

    // ---------- derived values ----------------------------------------------------
    fairPrice(pid) { return this.S.market[pid].cost * PRODUCTS[pid].markup; }
    buyCost(pid) { return this.S.market[pid].cost * (1 - 0.05 * this.S.hq.logistics); }
    capacity(biz, pid) {
      const T = BUSINESS_TYPES[biz.type];
      return Math.max(2, Math.ceil(T.traffic * PRODUCTS[pid].weight * (10 + 5 * biz.upgrades.storage)));
    }
    productivity(biz, fx) {
      return clamp(0.5 + 0.5 * biz.wageMult, 0.7, 1.3) * (1 + 0.03 * this.S.hq.hr) * (fx ? fx.productivity : 1);
    }
    throughput(biz, fx) {
      const T = BUSINESS_TYPES[biz.type];
      const auto = 1 + 0.3 * biz.upgrades.automation;
      if (biz.staff <= 0) return 0.25 * T.staffCap * auto;
      return biz.staff * T.staffCap * this.productivity(biz, fx) * auto;
    }
    dailyWage(biz, fx) {
      const T = BUSINESS_TYPES[biz.type];
      return T.wage * biz.wageMult * (1 - 0.06 * this.S.hq.hr) * (fx ? fx.wage : 1);
    }
    marketingFactor(biz) {
      const T = BUSINESS_TYPES[biz.type];
      return 1 + 0.4 * (1 - Math.exp(-biz.marketing / (T.rent * 3)));
    }
    competitionFactor(type, fx) {
      let pressure = 0;
      for (let i = 0; i < COMPETITORS.length; i++) {
        const def = COMPETITORS[i], c = this.S.competitors[i];
        if (c.acquired) continue;
        if (def.types[0] === '*' || def.types.includes(type)) pressure += c.strength;
      }
      return 1 / (1 + 0.09 * pressure * (fx ? fx.competition : 1));
    }
    saturation(type) {
      const n = this.S.businesses.filter(b => b.type === type).length;
      return Math.pow(0.9, Math.max(0, n - 1));
    }
    repFactor(rep) { return 0.6 + 0.8 * rep / 100; }
    trafficFor(biz, pid, fx) {
      const T = BUSINESS_TYPES[biz.type];
      const p = PRODUCTS[pid];
      const diff = DIFFICULTY[this.S.difficulty];
      return T.traffic * p.weight
        * (1 + 0.08 * biz.upgrades.renovation)
        * (1 + 0.06 * this.S.hq.marketing)
        * (biz.upgrades.loyalty ? 1.1 : 1)
        * this.saturation(biz.type)
        * this.repFactor(biz.rep)
        * this.marketingFactor(biz)
        * this.competitionFactor(biz.type, fx)
        * (fx ? fx.traffic : 1)
        * diff.demand;
    }
    demandMult(biz, pid, fx) {
      const p = PRODUCTS[pid];
      let m = this.S.market[pid].demand;
      if (fx) m *= fx.demandAll * (fx.demandCat[p.cat] || 1) * (fx.demandBiz[biz.type] || 1) * (fx.demandProduct[pid] || 1);
      return m;
    }
    priceFactor(biz, pid, price) {
      const p = PRODUCTS[pid];
      const fair = this.fairPrice(pid);
      const ratio = Math.max(0.05, price / fair);
      const el = p.elasticity * Math.pow(0.8, biz.upgrades.premium);
      return clamp(Math.pow(ratio, -el), 0, 3);
    }
    // Expected units demanded today for product at given price (before staffing limits)
    expectedDemand(biz, pid, price = biz.prices[pid], fx = this._fx || this.activeEffects()) {
      return this.trafficFor(biz, pid, fx) * this.demandMult(biz, pid, fx) * this.priceFactor(biz, pid, price);
    }
    recommendedStaff(biz) {
      const fx = this._fx || this.activeEffects();
      const T = BUSINESS_TYPES[biz.type];
      let total = 0;
      for (const pid of T.products) total += this.expectedDemand(biz, pid, biz.prices[pid], fx);
      const per = T.staffCap * this.productivity(biz, fx) * (1 + 0.3 * biz.upgrades.automation);
      return Math.max(1, Math.ceil(total / per));
    }
    inventoryValue(biz) {
      let v = 0; for (const pid in biz.stock) v += biz.stock[pid] * biz.avgCost[pid];
      return v;
    }
    totalInventoryValue() { let v = 0; for (const b of this.S.businesses) v += this.inventoryValue(b); return v; }
    totalDebt() { let d = 0; for (const l of this.S.loans) d += l.amount; return d; }
    totalStaff() { let n = 0; for (const b of this.S.businesses) n += b.staff; return n; }
    portfolioValue() {
      let v = 0;
      for (const cid in this.S.portfolio) { const c = this._comp(cid); if (c) v += this.S.portfolio[cid].shares * c.value / D.SHARES; }
      return v;
    }
    creditLimit() { return Math.round(2000 + 0.5 * Math.max(0, this.S.netAssets) + 0.1 * this.S.goodwill); }
    availableCredit() { return Math.max(0, this.creditLimit() - this.totalDebt()); }
    currentRate(fx) {
      const util = this.creditLimit() > 0 ? clamp(this.totalDebt() / this.creditLimit(), 0, 1) : 1;
      return BASE_RATE * DIFFICULTY[this.S.difficulty].rate * (1 + util) * (fx ? fx.rate : (this._fx ? this._fx.rate : 1));
    }
    bizCost(type) {
      const T = BUSINESS_TYPES[type];
      const n = this.S.businesses.filter(b => b.type === type).length;
      return Math.round(T.cost * Math.pow(1.35, n) * (1 - 0.08 * this.S.hq.franchise));
    }
    upgradeCost(biz, uid) {
      const U = UPGRADES[uid];
      const lvl = biz.upgrades[uid];
      if (lvl >= U.max) return null;
      return Math.round(BUSINESS_TYPES[biz.type].cost * U.costFactor * Math.pow(1.6, lvl));
    }
    hqCost(id) {
      const H = HQ_UPGRADES[id];
      const lvl = this.S.hq[id];
      if (lvl >= H.max) return null;
      return Math.round(H.base * Math.pow(H.mult, lvl));
    }
    bizSaleValue(biz) { return Math.round(biz.paid * 0.55 + biz.upgradesPaid * 0.4 + this.inventoryValue(biz) * 0.5); }
    _comp(id) { const i = COMPETITORS.findIndex(c => c.id === id); return i >= 0 ? this.S.competitors[i] : null; }
    compDef(id) { return COMPETITORS.find(c => c.id === id); }
    acquisitionPrice(id) { const c = this._comp(id); return Math.round(c.value * 1.25); }
    canAcquire(id) {
      const c = this._comp(id);
      return c && !c.acquired && this.S.valuation >= c.value * 1.5 && this.S.cash >= this.acquisitionPrice(id);
    }
    bizProfitEstimate(biz) { // recent average daily profit
      const h = biz.history;
      if (!h.length) return 0;
      const n = Math.min(7, h.length);
      let s = 0; for (let i = h.length - n; i < h.length; i++) s += h[i];
      return s / n;
    }

    // ---------- active event effects ----------------------------------------------
    activeEffects() {
      const S = this.S;
      const fx = { demandAll: 1, demandCat: {}, demandBiz: {}, demandProduct: {}, costAll: 1, costCat: {}, traffic: 1, sentiment: 0, rate: 1, wage: 1, productivity: 1, competition: 1 };
      const legal = S.hq.legal ? 0.65 : 1;
      const mul = (m, soft) => soft === 1 ? m : 1 + (m - 1) * soft;
      for (const ev of S.events.active) {
        const soft = ev.kind === 'bad' ? legal : 1;
        const f = ev.fx || {};
        if (f.demand) {
          if (f.demand.all) fx.demandAll *= mul(f.demand.all, soft);
          if (f.demand.cat) for (const c in f.demand.cat) fx.demandCat[c] = (fx.demandCat[c] || 1) * mul(f.demand.cat[c], soft);
          if (f.demand.biz) for (const b in f.demand.biz) fx.demandBiz[b] = (fx.demandBiz[b] || 1) * mul(f.demand.biz[b], soft);
          if (f.demand.product && ev.param && ev.param.product) fx.demandProduct[ev.param.product] = (fx.demandProduct[ev.param.product] || 1) * mul(f.demand.product, soft);
        }
        if (f.cost) {
          if (f.cost.all) fx.costAll *= mul(f.cost.all, soft);
          if (f.cost.cat) for (const c in f.cost.cat) fx.costCat[c] = (fx.costCat[c] || 1) * mul(f.cost.cat[c], soft);
          if (f.cost.catPick && ev.param && ev.param.cat) fx.costCat[ev.param.cat] = (fx.costCat[ev.param.cat] || 1) * f.cost.catPick;
        }
        if (f.traffic) fx.traffic *= mul(f.traffic, soft);
        if (f.sentiment) fx.sentiment += f.sentiment * soft;
        if (f.rate) fx.rate *= mul(f.rate, soft);
        if (f.wage) fx.wage *= mul(f.wage, soft);
        if (f.productivity) fx.productivity *= mul(f.productivity, soft);
        if (f.competition) fx.competition *= mul(f.competition, soft);
      }
      return fx;
    }
    costMult(pid, fx) { return fx.costAll * (fx.costCat[PRODUCTS[pid].cat] || 1); }

    // ---------- player actions ------------------------------------------------------
    biz(id) { return this.S.businesses.find(b => b.id === id); }

    buyInventory(bizId, pid, qty, silent = false) {
      const S = this.S, biz = this.biz(bizId);
      if (!biz || !(pid in biz.stock)) return { ok: false, msg: 'Invalid product.' };
      qty = Math.floor(qty);
      const cap = this.capacity(biz, pid);
      qty = Math.min(qty, cap - biz.stock[pid]);
      if (qty <= 0) return { ok: false, msg: 'Storage is full. Buy a Storage Expansion.' };
      const unit = this.buyCost(pid);
      const affordable = Math.floor(S.cash / unit);
      if (affordable <= 0) return { ok: false, msg: 'Not enough cash.' };
      qty = Math.min(qty, affordable);
      const cost = qty * unit;
      S.cash -= cost;
      const prev = biz.stock[pid];
      biz.avgCost[pid] = (prev * biz.avgCost[pid] + qty * unit) / (prev + qty);
      biz.stock[pid] += qty;
      // supply pressure: big purchases push wholesale prices up
      const m = S.market[pid];
      m.supply = clamp(m.supply - qty / (PRODUCTS[pid].volume * 12), 0.25, 1.6);
      if (!silent) this.emit('spend', { amount: cost, what: 'inventory' });
      return { ok: true, qty, cost };
    }
    sellInventory(bizId, pid, qty) {
      const S = this.S, biz = this.biz(bizId);
      if (!biz) return { ok: false };
      qty = Math.min(Math.floor(qty), biz.stock[pid]);
      if (qty <= 0) return { ok: false, msg: 'Nothing to sell.' };
      const value = qty * biz.avgCost[pid] * 0.5;
      biz.stock[pid] -= qty; S.cash += value;
      return { ok: true, value };
    }
    setPrice(bizId, pid, price) {
      const biz = this.biz(bizId);
      if (!biz || !(pid in biz.prices)) return { ok: false };
      price = Math.max(0.01, +price || 0);
      biz.prices[pid] = roundPrice(price);
      return { ok: true };
    }
    suggestedPrice(pid) { return roundPrice(this.fairPrice(pid) * 1.05); }
    applySuggestedPrices(bizId) {
      const biz = this.biz(bizId); if (!biz) return;
      for (const pid in biz.prices) biz.prices[pid] = this.suggestedPrice(pid);
    }
    hire(bizId, n = 1) {
      const biz = this.biz(bizId); if (!biz) return { ok: false };
      biz.staff += n;
      this.S.stats.maxStaff = Math.max(this.S.stats.maxStaff, this.totalStaff());
      return { ok: true };
    }
    fire(bizId, n = 1) {
      const S = this.S, biz = this.biz(bizId); if (!biz) return { ok: false };
      n = Math.min(n, biz.staff);
      if (n <= 0) return { ok: false, msg: 'No staff to let go.' };
      const severance = n * this.dailyWage(biz) * 2;
      biz.staff -= n; S.cash -= severance;
      return { ok: true, severance };
    }
    setWage(bizId, mult) { const b = this.biz(bizId); if (b) b.wageMult = clamp(Math.round(mult * 10) / 10, 0.6, 1.6); }
    setMarketing(bizId, amount) { const b = this.biz(bizId); if (b) b.marketing = Math.max(0, Math.round(amount)); }
    setAutoRestock(bizId, on, days) { const b = this.biz(bizId); if (b) { b.autoRestock = !!on; if (days) b.stockDays = clamp(Math.round(days), 1, 30); } }
    setAutoPrice(bizId, on) { const b = this.biz(bizId); if (b) b.autoPrice = !!on && this.S.hq.analytics > 0; }
    renameBusiness(bizId, name) { const b = this.biz(bizId); if (b && name.trim()) b.name = name.trim().slice(0, 28); }

    canBuyBusiness(type) {
      const S = this.S, T = BUSINESS_TYPES[type];
      if (!T) return { ok: false, msg: 'Unknown type' };
      if (S.valuation < T.unlock && !S.unlocked[type]) return { ok: false, msg: `Requires ${T.unlock} company value.` };
      const cost = this.bizCost(type);
      if (S.cash < cost) return { ok: false, msg: 'Not enough cash.' };
      return { ok: true, cost };
    }
    buyBusiness(type) {
      const S = this.S;
      const can = this.canBuyBusiness(type);
      if (!can.ok) return can;
      S.cash -= can.cost;
      const biz = this._makeBusiness(type, can.cost);
      // auto-restock on by default for new businesses (QoL), with 3 days of stock bought now if affordable
      biz.autoRestock = true;
      S.businesses.push(biz);
      for (const pid of BUSINESS_TYPES[type].products) {
        const want = Math.ceil(biz.last.expected[pid] * 3);
        this.buyInventory(biz.id, pid, want, true);
      }
      S.stats.bizBought++;
      this.log(BUSINESS_TYPES[type].icon, `Opened ${biz.name} for ${this.fmt(can.cost)}.`, 'good');
      this.emit('bizBought', { biz });
      this._checkAchievements();
      return { ok: true, biz };
    }
    sellBusiness(bizId) {
      const S = this.S, biz = this.biz(bizId);
      if (!biz) return { ok: false };
      const value = this.bizSaleValue(biz);
      S.businesses = S.businesses.filter(b => b.id !== bizId);
      S.cash += value;
      this.log('🏷️', `Sold ${biz.name} for ${this.fmt(value)}.`, 'neutral');
      this.emit('bizSold', { biz, value });
      return { ok: true, value };
    }
    buyUpgrade(bizId, uid) {
      const S = this.S, biz = this.biz(bizId);
      if (!biz) return { ok: false };
      const cost = this.upgradeCost(biz, uid);
      if (cost === null) return { ok: false, msg: 'Max level reached.' };
      if (S.cash < cost) return { ok: false, msg: 'Not enough cash.' };
      S.cash -= cost; biz.upgrades[uid]++; biz.upgradesPaid += cost; S.stats.upgradesBought++;
      if (uid === 'renovation') biz.rep = clamp(biz.rep + 10, 0, 100);
      this.emit('upgrade', { biz, uid, level: biz.upgrades[uid] });
      this._checkAchievements();
      return { ok: true };
    }
    buyHqUpgrade(id) {
      const S = this.S;
      const cost = this.hqCost(id);
      if (cost === null) return { ok: false, msg: 'Max level reached.' };
      if (S.cash < cost) return { ok: false, msg: 'Not enough cash.' };
      S.cash -= cost; S.hq[id]++; S.stats.upgradesBought++;
      this.log(HQ_UPGRADES[id].icon, `${HQ_UPGRADES[id].name} upgraded to level ${S.hq[id]}.`, 'good');
      this.emit('hqUpgrade', { id, level: S.hq[id] });
      return { ok: true };
    }
    takeLoan(amount) {
      const S = this.S;
      amount = Math.floor(amount);
      if (amount < 100) return { ok: false, msg: 'Minimum loan is $100.' };
      if (S.loans.length >= MAX_LOANS) return { ok: false, msg: `You can hold at most ${MAX_LOANS} loans.` };
      if (amount > this.availableCredit()) return { ok: false, msg: 'Exceeds your credit limit.' };
      const rate = this.currentRate();
      S.loans.push({ id: S.nextLoanId++, amount, principal: amount, rate, day: S.day, paidInterest: 0 });
      S.cash += amount; S.stats.loansTaken++;
      this.log('🏦', `Borrowed ${this.fmt(amount)} at ${(rate * 100).toFixed(2)}%/day.`, 'neutral');
      this.emit('loan', { amount });
      this._checkAchievements();
      return { ok: true };
    }
    repayLoan(loanId, amount) {
      const S = this.S;
      const loan = S.loans.find(l => l.id === loanId);
      if (!loan) return { ok: false };
      amount = Math.min(Math.floor(amount), loan.amount, Math.floor(S.cash));
      if (amount <= 0) return { ok: false, msg: 'Not enough cash.' };
      loan.amount -= amount; S.cash -= amount; S.stats.loansRepaid += amount;
      if (loan.amount <= 0.5) { S.loans = S.loans.filter(l => l.id !== loanId); this.log('🏦', 'Loan fully repaid.', 'good'); }
      this._checkAchievements();
      return { ok: true };
    }
    buyShares(compId, dollars) {
      const S = this.S, c = this._comp(compId);
      if (!c || c.acquired) return { ok: false };
      dollars = Math.min(Math.floor(dollars), Math.floor(S.cash));
      if (dollars < 10) return { ok: false, msg: 'Not enough cash.' };
      const price = c.value / D.SHARES;
      const fee = dollars * 0.005;
      const shares = (dollars - fee) / price;
      const pos = S.portfolio[compId] || (S.portfolio[compId] = { shares: 0, cost: 0 });
      pos.shares += shares; pos.cost += dollars;
      S.cash -= dollars;
      return { ok: true, shares };
    }
    sellShares(compId, shares) {
      const S = this.S, c = this._comp(compId), pos = S.portfolio[compId];
      if (!c || !pos || pos.shares <= 0) return { ok: false };
      shares = Math.min(shares, pos.shares);
      const price = c.value / D.SHARES;
      const gross = shares * price, fee = gross * 0.005;
      const costPart = pos.cost * (shares / pos.shares);
      const profit = gross - fee - costPart;
      pos.shares -= shares; pos.cost -= costPart;
      if (pos.shares < 1e-6) delete S.portfolio[compId];
      S.cash += gross - fee;
      S.stats.tradingProfit += profit;
      this._checkAchievements();
      return { ok: true, proceeds: gross - fee, profit };
    }
    acquireCompetitor(compId) {
      const S = this.S, c = this._comp(compId), def = this.compDef(compId);
      if (!this.canAcquire(compId)) return { ok: false, msg: 'You cannot afford this acquisition yet.' };
      const price = this.acquisitionPrice(compId);
      // cash out any shares first at the acquisition premium
      if (S.portfolio[compId]) this.sellShares(compId, S.portfolio[compId].shares);
      S.cash -= price;
      c.acquired = true;
      S.subsidiaries.push({ id: compId, name: def.name, icon: def.icon, value: c.value, income: c.value * 0.004 });
      S.stats.acquisitions++;
      this.log('🤝', `${S.company} acquires ${def.name} for ${this.fmt(price)}!`, 'good');
      this.emit('acquired', { name: def.name, icon: def.icon, price });
      this._checkAchievements();
      return { ok: true };
    }
    resolveChoice(index) {
      const S = this.S, pend = S.events.pending;
      if (!pend) return { ok: false };
      const def = EVENTS.find(e => e.id === pend.id);
      const choice = def.choices[index] || def.choices[def.choices.length - 1];
      S.events.pending = null;
      const param = pend.param;
      const bizObj = param.bizId ? this.biz(param.bizId) : null;
      if (choice.instant) {
        const ins = choice.instant;
        if (ins.payFee) { S.cash -= param.fee; S.lastDay.other -= param.fee; }
        if (ins.sellBiz && bizObj) { S.businesses = S.businesses.filter(b => b.id !== bizObj.id); S.cash += param.fee; }
        if (ins.repDelta && bizObj) bizObj.rep = clamp(bizObj.rep + ins.repDelta, 0, 100);
        if (ins.repDeltaAll) for (const b of S.businesses) b.rep = clamp(b.rep + ins.repDeltaAll, 0, 100);
        if (ins.inventoryLossPctProduct && bizObj && param.product) bizObj.stock[param.product] = Math.floor(bizObj.stock[param.product] * (1 - ins.inventoryLossPctProduct));
      }
      if (choice.fx) S.events.active.push({ id: def.id, title: def.title, icon: def.icon, kind: 'choice', days: choice.dur || 10, fx: choice.fx, param });
      const msg = this._fill(choice.msg, param);
      this.log(def.icon, msg, 'neutral');
      this.emit('choiceResolved', { msg, icon: def.icon });
      return { ok: true, msg };
    }

    // ---------- the daily tick ---------------------------------------------------------
    tick() {
      const S = this.S;
      if (S.flags.bankrupt) return;
      if (S.events.pending) { // waiting for the player's decision
        if (EVENTS.find(e => e.id === S.events.pending.id)) return;
        S.events.pending = null; // unknown event from an older build: drop it
      }
      S.day++;
      const fx = this._fx = this.activeEffects();
      const day = { revenue: 0, cogs: 0, wages: 0, rent: 0, marketing: 0, interest: 0, other: 0, profit: 0, units: 0, subsidiaries: 0, spoilage: 0, fees: 0 };

      // 1. auto pricing & auto restock
      for (const biz of S.businesses) {
        if (biz.autoPrice && S.hq.analytics) for (const pid in biz.prices) biz.prices[pid] = this.suggestedPrice(pid);
        if (biz.autoRestock) this._autoRestock(biz, fx);
      }
      // 2. run each business
      for (const biz of S.businesses) this._simulateBusiness(biz, fx, day);
      // 3. company finances
      for (const loan of S.loans) { const i = loan.amount * loan.rate * fx.rate; day.interest += i; loan.paidInterest += i; }
      S.cash -= day.interest;
      for (const sub of S.subsidiaries) { day.subsidiaries += sub.income; sub.value *= 1.001; sub.income = sub.value * 0.004; }
      S.cash += day.subsidiaries;
      day.profit = day.revenue - day.cogs - day.wages - day.rent - day.marketing - day.interest - day.spoilage + day.subsidiaries;
      // 4. market dynamics
      this._updateMarket(fx);
      // 5. events
      this._tickEvents(fx);
      // 6. competitors & ranking
      this._updateCompetitors(fx);
      // 7. valuation & history
      S.ema7 = S.ema7 === 0 && S.day === 1 ? day.profit : S.ema7 + (day.profit - S.ema7) * (2 / 8);
      S.ema30 = S.ema30 === 0 && S.day === 1 ? day.profit : S.ema30 + (day.profit - S.ema30) * (2 / 31);
      this._computeValuation();
      // overdraft handling
      if (S.cash < 0) {
        S.overdraftDays++;
        const fee = Math.max(1, -S.cash * 0.01);
        S.cash -= fee; day.fees += fee; day.other -= fee;
        if (S.overdraftDays === 1) this.emit('overdraft', { days: OVERDRAFT_LIMIT_DAYS });
        else if (S.overdraftDays === OVERDRAFT_LIMIT_DAYS - 3) this.emit('overdraftWarning', { left: 3 });
      } else S.overdraftDays = 0;
      S.lastDay = day;
      S.stats.totalRevenue += day.revenue; S.stats.totalProfit += day.profit; S.stats.unitsSold += day.units;
      S.stats.peakValue = Math.max(S.stats.peakValue, S.valuation);
      if (day.profit > 0) { S.streak++; S.stats.bestStreak = Math.max(S.stats.bestStreak, S.streak); } else S.streak = 0;
      this._updateRank();
      this._pushHistory();
      // 8. progression systems
      this._checkUnlocks();
      this._tickQuests();
      this._checkAchievements();
      // 9. bankruptcy & win
      const assets = this.totalInventoryValue() + S.businesses.reduce((a, b) => a + b.paid * 0.55, 0) + this.portfolioValue();
      if (!S.flags.bankrupt && (S.overdraftDays >= OVERDRAFT_LIMIT_DAYS || (S.cash < 0 && -S.cash > assets + 500 && S.day > 5))) {
        S.flags.bankrupt = true;
        this.log('💀', `${S.company} has gone bankrupt.`, 'bad');
        this.emit('bankrupt', {});
      }
      if (!S.flags.won && S.valuation >= D.WIN_VALUE) {
        S.flags.won = true;
        this.log('🏆', `${S.company} is worth $1 BILLION!`, 'good');
        this.emit('win', {});
      }
      this.emit('day', { day: S.day, summary: day });
      this._fx = null;
      return day;
    }

    _autoRestock(biz, fx) {
      const S = this.S;
      const T = BUSINESS_TYPES[biz.type];
      for (const pid of T.products) {
        const expected = Math.max(biz.last.expected[pid] || 0, this.expectedDemand(biz, pid, biz.prices[pid], fx));
        const target = Math.min(this.capacity(biz, pid), Math.ceil(expected * biz.stockDays * 1.1));
        const need = target - biz.stock[pid];
        if (need > 0 && S.cash > 0) {
          // never spend the last of the cash on auto-restock: keep a reserve of one day of wages & rent company-wide
          const reserve = this._dailyFixedCosts(fx);
          const spendable = S.cash - reserve;
          const unit = this.buyCost(pid);
          const qty = Math.min(need, Math.floor(spendable / unit));
          if (qty > 0) this.buyInventory(biz.id, pid, qty, true);
        }
      }
    }
    _dailyFixedCosts(fx) {
      let c = 0;
      for (const b of this.S.businesses) c += BUSINESS_TYPES[b.type].rent + b.staff * this.dailyWage(b, fx) + b.marketing;
      return c;
    }

    _simulateBusiness(biz, fx, day) {
      const S = this.S, T = BUSINESS_TYPES[biz.type];
      const last = { revenue: 0, cogs: 0, wages: 0, rent: T.rent, marketing: biz.marketing, profit: 0, sold: {}, expected: {}, lostStock: 0, lostStaff: 0, serviceRatio: 1, units: 0, spoiled: 0, demandUnits: 0 };
      // expected demand per product
      let total = 0, ratioSum = 0;
      for (const pid of T.products) {
        const e = this.expectedDemand(biz, pid, biz.prices[pid], fx);
        last.expected[pid] = e; total += e;
        ratioSum += biz.prices[pid] / this.fairPrice(pid);
      }
      const cap = this.throughput(biz, fx);
      const service = total > 0 ? Math.min(1, cap / total) : 1;
      last.serviceRatio = service;
      let unitsWanted = 0;
      for (const pid of T.products) {
        const want = last.expected[pid] * service;
        const units = stochRound(want);
        unitsWanted += units;
        const sold = Math.min(biz.stock[pid], units);
        last.sold[pid] = sold;
        if (sold > 0) {
          const price = biz.prices[pid];
          last.revenue += sold * price;
          last.cogs += sold * biz.avgCost[pid];
          biz.stock[pid] -= sold;
          last.units += sold;
          S.stats.unitsByProduct[pid] = (S.stats.unitsByProduct[pid] || 0) + sold;
          if (price > S.stats.biggestSale) S.stats.biggestSale = price;
          if (price >= 100000) this.emit('bigSale', { biz, pid, price, sold });
        }
        last.lostStock += Math.max(0, units - sold);
        // spoilage
        if (PRODUCTS[pid].perishable && biz.stock[pid] > 0) {
          const spoiled = stochRound(biz.stock[pid] * 0.03);
          if (spoiled > 0) { biz.stock[pid] -= spoiled; last.spoiled += spoiled * biz.avgCost[pid]; }
        }
      }
      last.lostStaff = total - total * service;
      last.demandUnits = total;
      last.wages = biz.staff * this.dailyWage(biz, fx);
      last.profit = last.revenue - last.cogs - last.wages - last.rent - last.marketing - last.spoiled;
      // reputation dynamics
      const stockoutFrac = unitsWanted > 0 ? last.lostStock / unitsWanted : 0;
      const staffFrac = 1 - service;
      const avgRatio = ratioSum / T.products.length;
      let delta = (biz.rep < 70 ? 0.5 : 0.15) - 3 * stockoutFrac - 3 * staffFrac;
      if (avgRatio > 1.4) delta -= (avgRatio - 1.4) * 2;
      if (avgRatio < 0.9) delta += 0.3;
      if (biz.staff === 0) delta -= 0.5;
      biz.rep = clamp(biz.rep + delta, 0, 100);
      // apply to company
      S.cash += last.revenue - last.wages - last.rent - last.marketing;
      day.revenue += last.revenue; day.cogs += last.cogs; day.wages += last.wages; day.rent += last.rent; day.marketing += last.marketing; day.units += last.units; day.spoilage += last.spoiled;
      biz.last = last;
      biz.history.push(last.profit); if (biz.history.length > 60) biz.history.shift();
    }

    _updateMarket(fx) {
      const S = this.S;
      for (const pid in PRODUCTS) {
        const p = PRODUCTS[pid], m = S.market[pid];
        m.supply = clamp(m.supply + (1 - m.supply) * 0.08 + gauss() * 0.015, 0.25, 1.6);
        m.demand = clamp(m.demand + (1 - m.demand) * 0.05 + gauss() * 0.04, 0.5, 2.0);
        m.cost = p.cost * Math.pow(m.supply, -0.6) * this.costMult(pid, fx) * (1 + gauss() * 0.01);
        m.history.push(m.cost); if (m.history.length > 90) m.history.shift();
      }
    }

    _tickEvents(fx) {
      const S = this.S;
      // expire
      const still = [];
      for (const ev of S.events.active) {
        ev.days--;
        if (ev.days > 0) still.push(ev);
        else {
          if (ev.id === 'recession' && S.cash > 0) S.stats.recessionsSurvived++;
          this.log(ev.icon, `${ev.title} is over.`, 'neutral');
          this.emit('eventEnd', { ev });
        }
      }
      S.events.active = still;
      // new event?
      let chance = 0.075 + Math.min(0.03, S.day / 20000);
      if (S.events.active.length >= MAX_ACTIVE_EVENTS) chance *= 0.3;
      if (S.day < 4) chance = 0;
      if (Math.random() >= chance) return;
      const diff = DIFFICULTY[S.difficulty];
      const eligible = EVENTS.filter(e => {
        if ((e.minDay || 0) > S.day) return false;
        if (S.events.active.some(a => a.id === e.id)) return false;
        if (e.needsMultiBiz && S.businesses.length < 2) return false;
        if (e.pickBiz || e.pickBizProduct) return S.businesses.length > 0;
        return true;
      });
      if (!eligible.length) return;
      const def = weightedPick(eligible, e => e.w * (e.kind === 'bad' ? diff.badEvents : 1));
      this._startEvent(def);
    }
    _fill(text, param) {
      if (!text) return '';
      return text.replace('{product}', param.productName || '').replace('{biz}', param.bizName || '').replace('{cat}', param.catName || '').replace('{fee}', param.fee != null ? this.fmt(param.fee) : '');
    }
    _startEvent(def) {
      const S = this.S;
      const param = {};
      const soldProducts = [...new Set(S.businesses.flatMap(b => BUSINESS_TYPES[b.type].products))];
      if (def.pickProduct) { param.product = soldProducts.length ? pick(soldProducts) : pick(Object.keys(PRODUCTS)); param.productName = PRODUCTS[param.product].name; }
      if (def.pickBiz) { const b = pick(S.businesses); param.bizId = b.id; param.bizName = b.name; }
      if (def.pickBizProduct) { const b = pick(S.businesses); param.bizId = b.id; param.bizName = b.name; param.product = pick(BUSINESS_TYPES[b.type].products); param.productName = PRODUCTS[param.product].name; }
      if (def.pickCat) { const cats = [...new Set(soldProducts.map(p => PRODUCTS[p].cat))]; param.cat = cats.length ? pick(cats) : 'food'; param.catName = D.CATEGORIES[param.cat]; }
      if (def.feePctOfValue) param.fee = Math.round(Math.max(def.feeMin, S.valuation * def.feePctOfValue));
      if (def.feePctOfCash) param.fee = Math.round(Math.max(def.feeMin, Math.max(0, S.cash) * def.feePctOfCash));
      if (def.feeFromBizPaid && param.bizId) param.fee = Math.round(this.biz(param.bizId).paid * def.feeFromBizPaid);
      const desc = this._fill(def.desc, param);
      S.stats.eventsSeen++;
      if (def.kind === 'choice') {
        S.events.pending = { id: def.id, param, desc };
        this.emit('choice', { def, param, desc });
        return;
      }
      const legal = S.hq.legal && def.kind === 'bad' ? 0.65 : 1;
      if (def.instant) {
        const ins = def.instant;
        let cashDelta = 0;
        if (ins.cashPct) cashDelta += Math.max(0, S.cash) * ins.cashPct * legal;
        if (ins.cashPctOfValue) cashDelta += Math.max(ins.cashMin || 0, S.valuation * ins.cashPctOfValue);
        if (cashDelta) { S.cash += cashDelta; S.lastDay.other += cashDelta; param.cashDelta = cashDelta; }
        if (ins.repDelta && param.bizId) { const b = this.biz(param.bizId); b.rep = clamp(b.rep + ins.repDelta, 0, 100); }
        if (ins.inventoryLossPct && param.bizId) { const b = this.biz(param.bizId); for (const pid in b.stock) b.stock[pid] = Math.floor(b.stock[pid] * (1 - ins.inventoryLossPct * legal)); }
        if (ins.competitorPct) for (const c of S.competitors) if (!c.acquired) c.value *= (1 + ins.competitorPct);
      }
      if (def.dur > 0) S.events.active.push({ id: def.id, title: def.title, icon: def.icon, kind: def.kind, days: def.dur, fx: def.fx || {}, param });
      this.log(def.icon, `${def.title}: ${desc}`, def.kind === 'bad' ? 'bad' : def.kind === 'good' ? 'good' : 'neutral');
      this.emit('event', { def, param, desc });
    }

    _updateCompetitors(fx) {
      const S = this.S;
      const diff = DIFFICULTY[S.difficulty];
      const recession = S.events.active.some(e => e.id === 'recession');
      const boom = S.events.active.some(e => e.id === 'boom');
      for (let i = 0; i < COMPETITORS.length; i++) {
        const def = COMPETITORS[i], c = S.competitors[i];
        if (c.acquired) continue;
        let r = def.growth * diff.rivalGrowth + def.vol * gauss() + (S.sentiment - 1) * 0.03;
        if (recession) r -= 0.003;
        if (boom) r += 0.002;
        c.value = Math.max(1000, c.value * (1 + r));
        c.history.push(c.value); if (c.history.length > 120) c.history.shift();
        c.strength = clamp(Math.log10(c.value) / 8, 0.3, 1.6);
        if (c.value > S.valuation && Math.random() < 0.004) this.emit('taunt', { name: def.name, icon: def.icon, text: pick(def.taunts) });
      }
    }
    ranking() {
      const S = this.S;
      const rows = [{ id: "you", name: S.company, icon: "🏢", value: S.valuation, you: true }];
      for (let i = 0; i < COMPETITORS.length; i++) {
        const c = S.competitors[i]; if (c.acquired) continue;
        rows.push({ id: COMPETITORS[i].id, name: COMPETITORS[i].name, icon: COMPETITORS[i].icon, value: c.value, hist: c.history });
      }
      rows.sort((a, b) => b.value - a.value);
      rows.forEach((r, i) => r.rank = i + 1);
      return rows;
    }
    _updateRank() {
      const S = this.S;
      const rows = this.ranking();
      const me = rows.find(r => r.you);
      const prev = S.rank || rows.length;
      S.rank = me.rank;
      if (S.day > 1 && me.rank < prev) {
        S.stats.rivalsBeaten += prev - me.rank;
        const passed = rows[me.rank]; // the one now directly below
        this.emit('rankUp', { rank: me.rank, passed: passed ? passed.name : null });
        if (me.rank === 1 && !S.stats.reachedRank1) { S.stats.reachedRank1 = true; }
      }
    }

    _computeValuation() {
      const S = this.S;
      const inv = this.totalInventoryValue();
      const bizAssets = S.businesses.reduce((a, b) => a + b.paid * 0.6 + b.upgradesPaid * 0.4, 0);
      const subs = S.subsidiaries.reduce((a, s) => a + s.value, 0);
      const debt = this.totalDebt();
      const net = S.cash + inv + bizAssets + subs + this.portfolioValue() - debt;
      // sentiment: mean-reverting random walk + event pressure
      const fx = this._fx || this.activeEffects();
      S.sentiment = clamp(S.sentiment + (1 - S.sentiment) * 0.03 + gauss() * 0.012 + fx.sentiment * 0.05, 0.6, 1.5);
      S.jitter = clamp(S.jitter * 0.7 + gauss() * 0.008, -0.04, 0.04);
      const growth = clamp((S.ema7 - S.ema30) / Math.max(Math.abs(S.ema30), 50), -0.5, 1.0);
      const streakBonus = 1 + Math.min(0.1, S.streak / 300);
      S.multiple = 100 * S.sentiment * (1 + 0.5 * growth) * (1 + 0.1 * S.hq.ir) * streakBonus;
      S.goodwill = Math.max(0, S.ema30) * S.multiple;
      S.netAssets = net;
      S.valuation = Math.max(0, (net + S.goodwill) * (1 + S.jitter));
      S.sharePrice = S.valuation / D.SHARES;
    }
    _pushHistory() {
      const S = this.S, h = S.history;
      h.valuation.push(S.valuation); h.cash.push(S.cash); h.revenue.push(S.lastDay.revenue); h.profit.push(S.lastDay.profit); h.debt.push(this.totalDebt()); h.rank.push(S.rank);
      for (const k in h) if (h[k].length > HIST_MAX) h[k].shift();
    }
    _checkUnlocks() {
      const S = this.S;
      for (const t of TYPE_ORDER) {
        if (!S.unlocked[t] && S.valuation >= BUSINESS_TYPES[t].unlock) {
          S.unlocked[t] = true;
          this.log(BUSINESS_TYPES[t].icon, `New business unlocked: ${BUSINESS_TYPES[t].name}!`, 'good');
          this.emit('unlock', { type: t });
        }
      }
    }
    _checkAchievements() {
      const S = this.S;
      for (const a of ACHIEVEMENTS) {
        if (S.achievements[a.id]) continue;
        let ok = false;
        try { ok = a.check(S); } catch (e) { ok = false; }
        if (ok) {
          S.achievements[a.id] = S.day;
          if (a.bonus) { S.cash += a.bonus; S.lastDay.other += a.bonus; }
          this.log(a.icon, `Achievement: ${a.name}${a.bonus ? ` (+${this.fmt(a.bonus)})` : ''}`, 'good');
          this.emit('achievement', { a });
        }
      }
    }

    // ---------- quests -----------------------------------------------------------------
    _questScaleReward(frac) {
      const S = this.S;
      const base = Math.max(400, S.valuation * 0.05, Math.max(0, S.ema30) * 15);
      return Math.max(100, niceRound(base * frac));
    }
    _generateQuest() {
      const S = this.S;
      const activeIds = new Set(S.quests.map(q => q.tid));
      const candidates = QUEST_TEMPLATES.filter(t => !activeIds.has(t.id));
      const soldProducts = [...new Set(S.businesses.flatMap(b => BUSINESS_TYPES[b.type].products))];
      for (let tries = 0; tries < 12; tries++) {
        const t = pick(candidates);
        if (!t) return null;
        const q = { tid: t.id, text: '', target: 0, progress: 0, baseline: 0, reward: this._questScaleReward(t.reward), done: false, created: S.day };
        const profitEst = Math.max(S.ema30, 40);
        switch (t.id) {
          case 'earn_cash': q.target = niceRound(profitEst * t.mult); q.baseline = S.stats.totalProfit; break;
          case 'sell_units': {
            if (!soldProducts.length) continue;
            const pid = pick(soldProducts);
            let e = 0; for (const b of S.businesses) if (b.last.expected[pid]) e += b.last.expected[pid];
            if (e < 0.3) continue;
            q.product = pid; q.target = Math.max(5, niceRound(e * t.mult)); q.baseline = S.stats.unitsByProduct[pid] || 0; break;
          }
          case 'rep': {
            const cands = S.businesses.filter(b => b.rep < 85);
            if (!cands.length) continue;
            const b = pick(cands); q.bizId = b.id; q.target = Math.min(95, Math.ceil((b.rep + 15) / 5) * 5); break;
          }
          case 'staff': { const n = this.totalStaff(); q.target = n < 10 ? n + 3 : Math.ceil(n * 1.4); break; }
          case 'upgrades': q.target = 2; q.baseline = S.stats.upgradesBought; break;
          case 'value': q.target = niceRound(Math.max(S.valuation * t.mult, 5000)); break;
          case 'businesses': q.target = S.businesses.length + 1; break;
          case 'cash': q.target = niceRound(Math.max(S.cash * t.mult, 2000)); break;
          case 'streak': q.target = S.stats.bestStreak >= 10 ? 20 : 10; break;
          case 'debtfree': if (this.totalDebt() <= 0) continue; q.target = 1; break;
        }
        q.text = t.text.replace('{target}', ['earn_cash', 'value', 'cash'].includes(t.id) ? this.fmt(q.target) : String(q.target))
          .replace('{product}', q.product ? PRODUCTS[q.product].name : '')
          .replace('{biz}', q.bizId ? this.biz(q.bizId).name : '');
        return q;
      }
      return null;
    }
    _questProgress(q) {
      const S = this.S;
      switch (q.tid) {
        case 'earn_cash': return S.stats.totalProfit - q.baseline;
        case 'sell_units': return (S.stats.unitsByProduct[q.product] || 0) - q.baseline;
        case 'rep': { const b = this.biz(q.bizId); return b ? b.rep : q.target; }
        case 'staff': return this.totalStaff();
        case 'upgrades': return S.stats.upgradesBought - q.baseline;
        case 'value': return S.valuation;
        case 'businesses': return S.businesses.length;
        case 'cash': return S.cash;
        case 'streak': return S.streak;
        case 'debtfree': return this.totalDebt() <= 0 ? 1 : 0;
      }
      return 0;
    }
    _tickQuests() {
      const S = this.S;
      for (const q of S.quests) {
        q.progress = this._questProgress(q);
        if (!q.done && q.progress >= q.target) {
          q.done = true; q.doneDay = S.day;
          S.cash += q.reward; S.lastDay.other += q.reward; S.stats.questsDone++;
          this.log('📜', `Quest complete: ${q.text} (+${this.fmt(q.reward)})`, 'good');
          this.emit('quest', { q });
        }
      }
      // drop quests tied to a business that no longer exists, and replace finished quests after a short delay
      S.quests = S.quests.filter(q => (!q.bizId || this.biz(q.bizId)) && (!q.done || S.day - q.doneDay < 2));
      if (S.quests.length < 3 && S.questCooldown-- <= 0) {
        const q = this._generateQuest();
        if (q) { S.quests.push(q); S.questCooldown = 2; }
      }
    }

    // ---------- persistence -------------------------------------------------------------
    save(running) {
      if (!this.S) return;
      this.S.savedAt = Date.now();
      this.S.wasRunning = !!running;
      try { root.localStorage && root.localStorage.setItem(SAVE_KEY, JSON.stringify(this.S)); } catch (e) { /* storage unavailable */ }
    }
    static hasSave() { try { return !!(root.localStorage && root.localStorage.getItem(SAVE_KEY)); } catch (e) { return false; } }
    static peekSave() { try { const s = JSON.parse(root.localStorage.getItem(SAVE_KEY)); return s; } catch (e) { return null; } }
    static clearSave() { try { root.localStorage && root.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
    load() {
      const s = Game.peekSave();
      if (!s || s.version !== 1 || !Array.isArray(s.businesses) || !s.market) return false;
      try {
        // Saves from older builds may lack rivals, products or fields added later: fill them in.
        const byId = {}; for (const c of (s.competitors || [])) byId[c.id] = c;
        s.competitors = COMPETITORS.map(def => byId[def.id] || { id: def.id, value: def.value * rnd(0.8, 1.25), history: [def.value], acquired: false, strength: 1, lastRank: 0 });
        for (const c of s.competitors) { if (!Array.isArray(c.history)) c.history = [c.value]; if (typeof c.strength !== 'number') c.strength = 1; }
        s.hq = s.hq || {}; for (const k in HQ_UPGRADES) if (s.hq[k] == null) s.hq[k] = 0;
        for (const pid in PRODUCTS) {
          if (!s.market[pid]) s.market[pid] = { cost: PRODUCTS[pid].cost, supply: 1, demand: 1, history: [PRODUCTS[pid].cost] };
          const m = s.market[pid];
          if (!Number.isFinite(m.cost) || m.cost <= 0) m.cost = PRODUCTS[pid].cost;
          if (!Number.isFinite(m.supply)) m.supply = 1; if (!Number.isFinite(m.demand)) m.demand = 1;
          if (!Array.isArray(m.history)) m.history = [m.cost];
        }
        s.businesses = s.businesses.filter(b => b && BUSINESS_TYPES[b.type]);
        for (const b of s.businesses) {
          b.upgrades = b.upgrades || {}; for (const uid in UPGRADES) if (b.upgrades[uid] == null) b.upgrades[uid] = 0;
          b.stock = b.stock || {}; b.avgCost = b.avgCost || {}; b.prices = b.prices || {};
          if (!b.last) b.last = { revenue: 0, cogs: 0, wages: 0, rent: 0, marketing: 0, profit: 0, sold: {}, expected: {}, lostStock: 0, lostStaff: 0, serviceRatio: 1, units: 0, spoiled: 0 };
          b.last.sold = b.last.sold || {}; b.last.expected = b.last.expected || {};
          for (const pid of BUSINESS_TYPES[b.type].products) {
            if (!Number.isFinite(b.stock[pid]) || b.stock[pid] < 0) b.stock[pid] = 0;
            if (!Number.isFinite(b.avgCost[pid])) b.avgCost[pid] = s.market[pid].cost;
            if (!Number.isFinite(b.prices[pid]) || b.prices[pid] <= 0) b.prices[pid] = roundPrice(s.market[pid].cost * PRODUCTS[pid].markup);
          }
          if (!Array.isArray(b.history)) b.history = [];
          if (!Number.isFinite(b.rep)) b.rep = 50;
          if (!Number.isFinite(b.staff) || b.staff < 0) b.staff = BUSINESS_TYPES[b.type].staff;
          if (!Number.isFinite(b.wageMult)) b.wageMult = 1;
          if (!Number.isFinite(b.marketing) || b.marketing < 0) b.marketing = 0;
          if (!Number.isFinite(b.stockDays)) b.stockDays = 4;
          if (!Number.isFinite(b.paid)) b.paid = 0; if (!Number.isFinite(b.upgradesPaid)) b.upgradesPaid = 0;
        }
        const fresh = new Game(); fresh.newGame({ company: s.company, difficulty: s.difficulty in DIFFICULTY ? s.difficulty : 'normal' });
        const F = fresh.S;
        for (const k of ['stats', 'flags', 'lastDay', 'history', 'events']) { s[k] = s[k] || {}; for (const kk in F[k]) if (s[k][kk] == null) s[k][kk] = F[k][kk]; }
        for (const k of ['quests', 'loans', 'subsidiaries', 'eventLog']) if (!Array.isArray(s[k])) s[k] = [];
        for (const k of ['achievements', 'unlocked', 'portfolio']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
        for (const k of ['sentiment', 'jitter', 'valuation', 'sharePrice', 'netAssets', 'goodwill', 'multiple', 'ema7', 'ema30', 'streak', 'overdraftDays', 'questCooldown', 'rank', 'nextBizId', 'nextLoanId', 'day', 'cash']) if (typeof s[k] !== 'number' || !isFinite(s[k])) s[k] = F[k];
        if (!(s.difficulty in DIFFICULTY)) s.difficulty = 'normal';
        if (s.events.pending && !EVENTS.find(e => e.id === s.events.pending.id)) s.events.pending = null;
        s.events.active = (s.events.active || []).filter(ev => ev && EVENTS.find(e => e.id === ev.id));
        this.S = s;
        return true;
      } catch (e) {
        if (root.console) console.error('Save could not be migrated', e);
        return false;
      }
    }
    // Simulate time that passed while the tab was closed (capped, stops if cash goes negative)
    offlineProgress(maxDays = 20, secondsPerDay = 1) {
      const S = this.S;
      if (!S.wasRunning || !S.savedAt) return null;
      const elapsed = (Date.now() - S.savedAt) / 1000;
      let days = Math.min(maxDays, Math.floor(elapsed / secondsPerDay));
      if (days < 2) return null;
      const startCash = S.cash, startVal = S.valuation, startDay = S.day;
      let ran = 0;
      const silent = this.listeners; this.listeners = [];
      for (let i = 0; i < days; i++) {
        if (S.events.pending) this.resolveChoice(1);
        this.tick();
        ran++;
        if (S.cash < 0 || S.flags.bankrupt || S.flags.won) break;
      }
      this.listeners = silent;
      return { days: ran, cashDelta: S.cash - startCash, valueDelta: S.valuation - startVal, fromDay: startDay };
    }

    // ---------- formatting -------------------------------------------------------------------
    fmt(n, opts = {}) {
      if (typeof n !== 'number' || !isFinite(n)) return '$—';
      const neg = n < 0; n = Math.abs(n);
      let s;
      if (n >= 1e12) s = (n / 1e12).toFixed(2) + 'T';
      else if (n >= 1e9) s = (n / 1e9).toFixed(2) + 'B';
      else if (n >= 1e6) s = (n / 1e6).toFixed(2) + 'M';
      else if (n >= 1e4) s = (n / 1e3).toFixed(1) + 'K';
      else if (n >= 100 || opts.whole) s = Math.round(n).toLocaleString('en-US');
      else s = n.toFixed(2);
      return (neg ? '-$' : '$') + s;
    }
  }

  const API = { Game, util: { clamp, rnd, pick, gauss, stochRound, niceRound, roundPrice } };
  root.MM_ENGINE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
