/* =========================================================================
   MARKET MAYHEM — simulation engine (no DOM; also runs in Node for testing)
   ========================================================================= */
(function (root) {
  'use strict';
  const D = root.MM_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  const { PRODUCTS, BUSINESS_TYPES, TYPE_ORDER, UPGRADES, HQ_UPGRADES, COMPETITORS, EVENTS, QUEST_TEMPLATES, ACHIEVEMENTS, DIFFICULTY, ECONOMY, TAX_BRACKETS, SEASONS, OFFER_TEMPLATES, PRESTIGE, DAILY } = D;

  // ---------- helpers ---------------------------------------------------------
  // Randomness goes through rand() so a seeded run (the Daily Sprint) is reproducible.
  // rngState === null means plain Math.random.
  let rngState = null;
  function rand() {
    if (rngState === null) return Math.random();
    rngState = (rngState + 0x6D2B79F5) | 0;
    let t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function hashSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a = 0, b = 1) => a + rand() * (b - a);
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  function gauss() { // standard normal (Box-Muller)
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const stochRound = x => { const f = Math.floor(x); return f + (rand() < x - f ? 1 : 0); };
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
    let r = rand() * total;
    for (const it of items) { r -= wfn(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }

  const SAVE_KEY = 'market_mayhem_save_v1';
  const META_KEY = 'market_mayhem_meta_v1';
  const DAYS_PER_YEAR = 360;
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
    // meta: the persistent Legacy record (see Game.loadMeta). challenge: a date string
    // for the Daily Sprint; the run is then seeded and ends after DAILY.days.
    newGame({ company = 'Pixel & Co.', difficulty = 'normal', meta = null, challenge = null } = {}) {
      const perks = Object.assign({ seed: 0, analytics: 0, credit: 0, launch: 0, shield: 0 }, meta && meta.perks ? meta.perks : {});
      const prestige = challenge ? 0 : (meta && meta.level) || 0;
      const seed = challenge ? hashSeed('mm-daily-' + challenge) : null;
      rngState = seed;
      const market = {};
      for (const pid in PRODUCTS) {
        const p = PRODUCTS[pid];
        market[pid] = { cost: p.cost * rnd(0.92, 1.08), supply: rnd(0.95, 1.05), demand: rnd(0.9, 1.1), history: [] };
      }
      const S = this.S = {
        version: 1,
        company, difficulty,
        day: 0,
        cash: D.START_CASH + (challenge ? 0 : perks.seed * 2500),
        businesses: [],
        nextBizId: 1,
        market,
        loans: [], nextLoanId: 1,
        hq: {},
        events: { active: [], pending: null },
        eventLog: [],
        competitors: COMPETITORS.map(c => ({ id: c.id, value: c.value * rnd(0.8, 1.25), history: [], acquired: false, strength: 1, lastRank: 0,
          extraTypes: [], slump: 0, priceWar: 0, priceWarType: null, warCooldown: 0, bust: false })),
        portfolio: {},
        subsidiaries: [],
        offers: [], nextOfferId: 1,
        sentiment: 1.0,
        jitter: 0,
        valuation: 0, sharePrice: 0, netAssets: 0, goodwill: 0, multiple: 0,
        ema7: 0, ema30: 0,
        history: { valuation: [], cash: [], revenue: [], profit: [], debt: [], rank: [] },
        streak: 0, overdraftDays: 0, taxLossCarry: 0, econ: 3,
        marginDays: 0, lowRunwayDays: 0, waived: { margin: false, hostile: false },
        prestige, winValue: D.WIN_VALUE * Math.pow(PRESTIGE.targetGrowth, prestige), perks: challenge ? { seed: 0, analytics: 0, credit: 0, launch: 0, shield: 0 } : perks,
        seed, rngState: seed, challenge, year: { startValue: 0, startProfit: 0, levy: 0 },
        quests: [], questCooldown: 0,
        achievements: {},
        unlocked: {},
        stats: { unitsSold: 0, totalRevenue: 0, totalProfit: 0, loansTaken: 0, loansRepaid: 0, maxStaff: 0, recessionsSurvived: 0,
          rivalsBeaten: 0, reachedRank1: false, acquisitions: 0, biggestSale: 0, tradingProfit: 0, bestStreak: 0, questsDone: 0,
          upgradesBought: 0, eventsSeen: 0, unitsByProduct: {}, peakValue: 0, bizBought: 0, taxPaid: 0,
          closeCalls: 0, priceWarsWon: 0, leviesPaid: 0, offersTaken: 0, raidsSurvived: 0, bestDayProfit: 0, milestones: {}, marginCalls: 0, staffQuit: 0, levyTotal: 0 },
        flags: { won: false, bankrupt: false, tutorial: 0, continued: false, soldOut: false, sprintDone: false },
        lastDay: { revenue: 0, cogs: 0, wages: 0, rent: 0, marketing: 0, overhead: 0, upkeep: 0, hqUpkeep: 0, interest: 0, tax: 0, other: 0, pretax: 0, profit: 0, units: 0, subsidiaries: 0 },
        rank: 0,
        savedAt: Date.now(),
      };
      for (const k in HQ_UPGRADES) S.hq[k] = 0;
      if (S.perks.analytics) S.hq.analytics = 1;
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
      S.year.startValue = S.valuation;
      S.rank = this.ranking().find(r => r.you).rank;
      this._pushHistory();
      while (S.quests.length < 3) { const q = this._generateQuest(); if (!q) break; S.quests.push(q); }
      this.log('🏪', `${company} opens its first Corner Store with ${this.fmt(S.cash)}.`, 'good');
      if (prestige) this.log('🏛️', `IPO #${prestige} legacy: the target is now ${this.fmt(S.winValue)}, tax and rivals are tougher.`, 'neutral');
      if (challenge) this.log('⏱️', `${DAILY.name} ${challenge}: maximise company value by day ${DAILY.days}.`, 'neutral');
      S.rngState = rngState;
      return S;
    }
    // Reproducible daily seed: everyone playing the same date gets the same markets.
    static todayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
    static loadMeta() {
      const base = { level: 0, points: 0, perks: { seed: 0, analytics: 0, credit: 0, launch: 0, shield: 0 }, runs: [], daily: {}, bestDay: null };
      try { const m = JSON.parse(root.localStorage.getItem(META_KEY)); if (m && typeof m === 'object') { const out = Object.assign(base, m); out.perks = Object.assign(base.perks, m.perks || {}); out.daily = m.daily || {}; out.runs = Array.isArray(m.runs) ? m.runs : []; return out; } } catch (e) { /* ignore */ }
      return base;
    }
    static saveMeta(meta) { try { root.localStorage && root.localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* ignore */ } }
    static buyPerk(meta, id) {
      const P = PRESTIGE.perks[id]; if (!P) return { ok: false, msg: 'Unknown perk.' };
      if ((meta.perks[id] || 0) >= P.max) return { ok: false, msg: 'Already at max level.' };
      if (meta.points < P.cost) return { ok: false, msg: `Needs ${P.cost} legacy point${P.cost > 1 ? 's' : ''}.` };
      meta.points -= P.cost; meta.perks[id] = (meta.perks[id] || 0) + 1; Game.saveMeta(meta);
      return { ok: true };
    }
    // Run summary, used by the win / bankrupt / sprint screens and recorded to the legacy.
    runSummary() {
      const S = this.S;
      return { company: S.company, difficulty: S.difficulty, day: S.day, valuation: S.valuation, peak: S.stats.peakValue, businesses: S.businesses.length,
        profit: S.stats.totalProfit, bestDay: S.stats.bestDayProfit, milestones: Object.assign({}, S.stats.milestones), achievements: Object.keys(S.achievements).length,
        rank: S.rank, prestige: S.prestige, won: S.flags.won, bankrupt: S.flags.bankrupt, soldOut: S.flags.soldOut, challenge: S.challenge, taxPaid: S.stats.taxPaid, at: Date.now() };
    }
    // Float the company. Points scale with speed and difficulty; the next run is harder.
    goPublic(meta) {
      const S = this.S;
      if (!S.flags.won || S.challenge) return { ok: false, msg: 'Only a winning run can go public.' };
      let points = 2;
      if (S.day <= 900) points += 2; else if (S.day <= 1300) points += 1;
      if (S.difficulty === 'hard') points += 2; else if (S.difficulty === 'easy') points -= 1;
      if (S.flags.soldOut) points = Math.max(1, points - 1);
      points = Math.max(1, points);
      meta.level = (meta.level || 0) + 1; meta.points = (meta.points || 0) + points;
      meta.runs.unshift(Object.assign(this.runSummary(), { points })); if (meta.runs.length > 20) meta.runs.length = 20;
      Game.saveMeta(meta);
      return { ok: true, points, level: meta.level };
    }
    recordRun(meta) {
      const S = this.S;
      const sum = this.runSummary();
      if (S.challenge) { const prev = meta.daily[S.challenge]; if (!prev || sum.valuation > prev.valuation) meta.daily[S.challenge] = { valuation: sum.valuation, day: sum.day, company: S.company }; if (!meta.bestDay || sum.valuation > meta.bestDay.valuation) meta.bestDay = { valuation: sum.valuation, date: S.challenge }; }
      else { meta.runs.unshift(sum); if (meta.runs.length > 20) meta.runs.length = 20; }
      Game.saveMeta(meta);
      return sum;
    }

    _makeBusiness(type, paid) {
      const T = BUSINESS_TYPES[type];
      const S = this.S;
      const count = S.businesses.filter(b => b.type === type).length;
      const biz = {
        id: S.nextBizId++, type, name: count ? `${T.name} #${count + 1}` : T.name,
        paid, upgradesPaid: 0,
        staff: T.staff, wageMult: 1.0, marketing: 0, rep: 50,
        trainees: [], manager: false,
        autoRestock: false, stockDays: 4, autoPrice: false,
        stock: {}, avgCost: {}, prices: {}, upgrades: {},
        last: { revenue: 0, cogs: 0, wages: 0, rent: 0, marketing: 0, overhead: 0, upkeep: 0, pretax: 0, tax: 0, net: 0, profit: 0, sold: {}, expected: {}, lostStock: 0, lostStaff: 0, serviceRatio: 1, units: 0, spoiled: 0 },
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

    // ---------- upgrade effects ------------------------------------------------
    // Effects are additive per level unless the key ends in "Mult" (multiplicative).
    bizEff(biz, key) {
      let v = 0;
      for (const uid in UPGRADES) {
        const lvl = biz.upgrades[uid] || 0; if (!lvl) continue;
        const f = UPGRADES[uid].fx[key]; if (f != null) v += f * lvl;
      }
      return v;
    }
    bizEffMul(biz, key) {
      let v = 1;
      for (const uid in UPGRADES) {
        const lvl = biz.upgrades[uid] || 0; if (!lvl) continue;
        const f = UPGRADES[uid].fx[key]; if (f != null) v *= Math.pow(f, lvl);
      }
      return v;
    }
    hqEff(key) {
      let v = 0;
      for (const id in HQ_UPGRADES) {
        const lvl = this.S.hq[id] || 0; if (!lvl) continue;
        const f = HQ_UPGRADES[id].fx[key]; if (f != null) v += f * lvl;
      }
      return v;
    }
    diff() { return DIFFICULTY[this.S.difficulty] || DIFFICULTY.normal; }

    // ---------- derived values ----------------------------------------------------
    fairPrice(pid) { return this.S.market[pid].cost * PRODUCTS[pid].markup; }
    buyCost(pid, biz) {
      const disc = this.hqEff('buyCost') + (biz ? this.bizEff(biz, 'buyCost') : 0);
      return this.S.market[pid].cost * clamp(1 + disc, 0.4, 1);
    }
    capacity(biz, pid) {
      const T = BUSINESS_TYPES[biz.type];
      const days = 10 + this.bizEff(biz, 'capacityDays') + this.hqEff('capacityDays');
      return Math.max(2, Math.ceil(T.traffic * PRODUCTS[pid].weight * days));
    }
    productivity(biz, fx) {
      return clamp(0.5 + 0.5 * biz.wageMult, 0.7, 1.3)
        * (1 + this.bizEff(biz, 'productivity') + this.hqEff('productivity') + (biz.manager ? 0.15 : 0))
        * (fx ? fx.productivity : 1);
    }
    traineeCount(biz) { let n = 0; for (const t of (biz.trainees || [])) n += t.n; return n; }
    // Staff in training work below speed, so a fresh hire is not instant capacity.
    effectiveStaff(biz) { return Math.max(0, biz.staff - (1 - ECONOMY.traineeSpeed) * this.traineeCount(biz)); }
    throughput(biz, fx) {
      const T = BUSINESS_TYPES[biz.type];
      const auto = (1 + this.bizEff(biz, 'throughput')) * (biz.manager ? 1.15 : 1);
      if (biz.staff <= 0) return 0.25 * T.staffCap * auto;
      return this.effectiveStaff(biz) * T.staffCap * this.productivity(biz, fx) * auto;
    }
    // Talent gets pricier as the company grows and competes for it. The curve steepens
    // late so payroll is a real bill for a billion-dollar company.
    wageIndex() {
      const v = Math.max(1, this.S.valuation / 20000);
      const soften = clamp(1 + this.hqEff('wageInflation'), 0.4, 1);
      const l = Math.log10(v);
      return 1 + (ECONOMY.wageInflation * l + ECONOMY.wageInflation2 * l * l) * soften;
    }
    // Daily chance that one employee quits. Paying above market keeps people.
    quitRate(biz) {
      const soften = clamp(1 + this.hqEff('wageInflation'), 0.4, 1);
      return Math.max(0, ECONOMY.turnover * (1.35 - biz.wageMult)) * soften * (biz.rep < 30 ? 1.5 : 1);
    }
    // Days of fixed costs the cash pile covers. The number to watch.
    runway() {
      const S = this.S;
      const daily = this._dailyFixedCosts(this._fx || this.activeEffects());
      if (S.cash <= 0) return 0;
      return daily > 0 ? S.cash / daily : Infinity;
    }
    season(day = this.S.day) {
      const m = Math.floor(((Math.max(1, day) - 1) % DAYS_PER_YEAR) / 30) + 1;
      return SEASONS.find(s => s.months.includes(m)) || SEASONS[0];
    }
    yearDay(day = this.S.day) { return ((Math.max(1, day) - 1) % DAYS_PER_YEAR) + 1; }
    daysToLevy() { return DAYS_PER_YEAR - this.yearDay(); }
    levyDue() { return Math.round(this.S.valuation * ECONOMY.annualLevy); }
    dailyWage(biz, fx) {
      const T = BUSINESS_TYPES[biz.type];
      const eff = clamp(1 + this.hqEff('wages') + this.bizEff(biz, 'wages'), 0.45, 1.4);
      return T.wage * biz.wageMult * eff * this.wageIndex() * (fx ? fx.wage : 1);
    }
    repFloor(biz) { return clamp(this.bizEff(biz, 'repFloor') + this.hqEff('repFloor'), 0, 60); }

    // ---------- overhead, upkeep and tax ------------------------------------------
    overheadRate() {
      const n = this.S.businesses.length;
      const raw = ECONOMY.overheadBase + ECONOMY.overheadPerBiz * Math.max(0, n - 1);
      return clamp(raw, 0, ECONOMY.overheadMax) * clamp(1 + this.hqEff('overhead'), 0.5, 1) * this.diff().overhead;
    }
    bizOverhead(biz) { return BUSINESS_TYPES[biz.type].rent * this.overheadRate(); }
    totalOverhead() { let v = 0; for (const b of this.S.businesses) v += this.bizOverhead(b); return v; }
    upgradeUpkeep(biz, uid) {
      const U = UPGRADES[uid], lvl = biz.upgrades[uid] || 0;
      let sum = 0;
      for (let i = 0; i < lvl; i++) sum += BUSINESS_TYPES[biz.type].cost * U.cost * Math.pow(U.growth, i);
      return sum * U.upkeep;
    }
    bizUpkeep(biz) { let v = 0; for (const uid in UPGRADES) v += this.upgradeUpkeep(biz, uid); return v; }
    hqUpkeep() {
      let v = 0;
      for (const id in HQ_UPGRADES) {
        const H = HQ_UPGRADES[id], lvl = this.S.hq[id] || 0;
        for (let i = 0; i < lvl; i++) v += H.base * Math.pow(H.mult, i) * H.upkeep;
      }
      return v;
    }
    taxRate() {
      const avg = Math.max(0, this.S.ema30);
      let rate = TAX_BRACKETS[TAX_BRACKETS.length - 1].rate;
      for (const b of TAX_BRACKETS) if (avg <= b.upTo) { rate = b.rate; break; }
      const legacy = 1 + PRESTIGE.taxPerLevel * (this.S.prestige || 0);
      return clamp((rate - this.hqEff('taxCut')) * this.diff().tax * legacy, 0, 0.5);
    }
    marketingFactor(biz) {
      const T = BUSINESS_TYPES[biz.type];
      const power = 0.4 * (1 + this.bizEff(biz, 'marketing'));
      return 1 + power * (1 - Math.exp(-biz.marketing / (T.rent * 3)));
    }
    rivalInType(c, def, type) { return def.types[0] === '*' || def.types.includes(type) || (c.extraTypes || []).includes(type); }
    competitionFactor(type, fx) {
      let pressure = 0;
      for (let i = 0; i < COMPETITORS.length; i++) {
        const def = COMPETITORS[i], c = this.S.competitors[i];
        if (c.acquired || c.bust) continue;
        if (this.rivalInType(c, def, type)) pressure += c.strength;
      }
      return 1 / (1 + ECONOMY.competition * pressure * (fx ? fx.competition : 1));
    }
    // A rival running a price war in this sector takes customers unless you match.
    priceWarIn(type) {
      for (let i = 0; i < COMPETITORS.length; i++) { const c = this.S.competitors[i]; if (!c.acquired && !c.bust && c.priceWar > 0 && c.priceWarType === type) return { c, def: COMPETITORS[i] }; }
      return null;
    }
    priceWarFactor(biz, pid) {
      const war = this.priceWarIn(biz.type); if (!war) return 1;
      return biz.prices[pid] / this.fairPrice(pid) <= ECONOMY.priceWarMatch ? 1 : ECONOMY.priceWarPenalty;
    }
    saturation(type) {
      const n = this.S.businesses.filter(b => b.type === type).length;
      const s = clamp(ECONOMY.saturation - this.hqEff('saturation'), 0.5, 0.97);
      return Math.pow(s, Math.max(0, n - 1));
    }
    repFactor(rep) { return 0.6 + 0.8 * rep / 100; }
    trafficFor(biz, pid, fx) {
      const T = BUSINESS_TYPES[biz.type];
      const p = PRODUCTS[pid];
      const diff = DIFFICULTY[this.S.difficulty];
      return T.traffic * p.weight
        * (1 + this.bizEff(biz, 'traffic') + this.hqEff('traffic'))
        * this.saturation(biz.type)
        * this.repFactor(biz.rep)
        * this.marketingFactor(biz)
        * this.competitionFactor(biz.type, fx)
        * this.priceWarFactor(biz, pid)
        * (fx ? fx.traffic : 1)
        * diff.demand;
    }
    demandMult(biz, pid, fx) {
      const p = PRODUCTS[pid];
      let m = this.S.market[pid].demand * (1 + this.bizEff(biz, 'demand'));
      if (fx) m *= fx.demandAll * (fx.demandCat[p.cat] || 1) * (fx.demandBiz[biz.type] || 1) * (fx.demandProduct[pid] || 1);
      return m;
    }
    priceFactor(biz, pid, price) {
      const p = PRODUCTS[pid];
      const fair = this.fairPrice(pid);
      const ratio = Math.max(0.05, price / fair);
      const el = Math.max(0.5, p.elasticity * (1 + this.bizEff(biz, 'priceSens') + this.hqEff('priceSens')));
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
      const per = T.staffCap * this.productivity(biz, fx) * (1 + 0.3 * biz.upgrades.automation) * (biz.manager ? 1.15 : 1);
      // trainees count for less, so the recommendation covers the gap while they learn
      return Math.max(1, Math.ceil(total / per + (1 - ECONOMY.traineeSpeed) * this.traineeCount(biz)));
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
    // Credit is backed by tangible assets: shares are haircut, and goodwill can only add
    // a capped slice on top. A credit crunch event shrinks the whole line.
    creditLimit(fx) {
      const S = this.S;
      const tangible = Math.max(0, S.netAssets - this.portfolioValue() * (1 - ECONOMY.shareCollateral));
      const goodwillPart = Math.min(0.22 * Math.max(0, S.goodwill), ECONOMY.goodwillCreditCap * tangible);
      const f = fx || this._fx || this.activeEffects();
      const perk = 1 + 0.15 * ((S.perks && S.perks.credit) || 0);
      return Math.round((2500 + 0.75 * tangible + goodwillPart) * (1 + this.hqEff('credit')) * perk * (f.credit || 1));
    }
    availableCredit() { return Math.max(0, this.creditLimit() - this.totalDebt()); }
    currentRate(fx) {
      const util = this.creditLimit() > 0 ? clamp(this.totalDebt() / this.creditLimit(), 0, 1) : 1;
      const dept = clamp(1 + this.hqEff('interest'), 0.4, 1);
      return BASE_RATE * this.diff().rate * (1 + util) * dept * (fx ? fx.rate : (this._fx ? this._fx.rate : 1));
    }
    bizCost(type) {
      const S = this.S, T = BUSINESS_TYPES[type];
      const n = S.businesses.filter(b => b.type === type).length;
      const launch = S.day < 200 && S.perks ? 1 - 0.1 * (S.perks.launch || 0) : 1;
      return Math.round(T.cost * Math.pow(ECONOMY.bizCostGrowth, n) * clamp(1 + this.hqEff('bizCost'), 0.5, 1) * launch);
    }
    upgradeCost(biz, uid) {
      const U = UPGRADES[uid];
      const lvl = biz.upgrades[uid] || 0;
      if (lvl >= U.max) return null;
      return Math.round(BUSINESS_TYPES[biz.type].cost * U.cost * Math.pow(U.growth, lvl));
    }
    hqCost(id) {
      const H = HQ_UPGRADES[id];
      const lvl = this.S.hq[id] || 0;
      if (lvl >= H.max) return null;
      return Math.round(H.base * Math.pow(H.mult, lvl));
    }
    // Returns null when unlocked, otherwise the reason it is still locked.
    upgradeLock(biz, uid) {
      const req = UPGRADES[uid].req; if (!req) return null;
      for (const k in req) if ((biz.upgrades[k] || 0) < req[k]) return `Needs ${UPGRADES[k].name} level ${req[k]}`;
      return null;
    }
    hqLock(id) {
      const req = HQ_UPGRADES[id].req; if (!req) return null;
      for (const k in req) if ((this.S.hq[k] || 0) < req[k]) return `Needs ${HQ_UPGRADES[k].name} level ${req[k]}`;
      return null;
    }
    bizSaleValue(biz) { return Math.round(biz.paid * 0.55 + biz.upgradesPaid * 0.4 + this.inventoryValue(biz) * 0.5); }
    _comp(id) { const i = COMPETITORS.findIndex(c => c.id === id); return i >= 0 ? this.S.competitors[i] : null; }
    compDef(id) { return COMPETITORS.find(c => c.id === id); }
    acquisitionPrice(id) { const c = this._comp(id); return Math.round(c.value * ECONOMY.acquirePremium); }
    canAcquire(id) {
      const c = this._comp(id);
      return c && !c.acquired && !c.bust && this.S.valuation >= c.value * 1.5 && this.S.cash >= this.acquisitionPrice(id);
    }
    subInvestCost(sub) { return Math.round(sub.value * ECONOMY.subInvestCost); }
    // Share prices carry a spread: you buy at the ask and sell at the bid.
    sharePrice(compId, side) { const c = this._comp(compId); const mid = c.value / D.SHARES; const half = ECONOMY.tradeSpread / 2; return side === 'buy' ? mid * (1 + half) : side === 'sell' ? mid * (1 - half) : mid; }
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
      const fx = { demandAll: 1, demandCat: {}, demandBiz: {}, demandProduct: {}, costAll: 1, costCat: {}, traffic: 1, sentiment: 0, rate: 1, wage: 1, productivity: 1, competition: 1, credit: 1 };
      const legal = S.hq.legal ? 0.65 : 1;
      const mul = (m, soft) => soft === 1 ? m : 1 + (m - 1) * soft;
      // the season is a standing effect
      const season = this.season();
      for (const c in season.demandCat) fx.demandCat[c] = season.demandCat[c];
      fx.costAll *= season.costAll || 1;
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
        if (f.credit) fx.credit *= mul(f.credit, soft);
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
      const unit = this.buyCost(pid, biz);
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
      const impact = clamp(1 + this.hqEff('supplyImpact'), 0.2, 1);
      m.supply = clamp(m.supply - (qty * impact) / (PRODUCTS[pid].volume * 12), 0.25, 1.6);
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
      n = Math.max(0, Math.floor(n)); if (!n) return { ok: false };
      biz.staff += n;
      biz.trainees = biz.trainees || [];
      biz.trainees.push({ n, days: ECONOMY.traineeDays });
      this.S.stats.maxStaff = Math.max(this.S.stats.maxStaff, this.totalStaff());
      return { ok: true };
    }
    fire(bizId, n = 1) {
      const S = this.S, biz = this.biz(bizId); if (!biz) return { ok: false };
      n = Math.min(n, biz.staff);
      if (n <= 0) return { ok: false, msg: 'No staff to let go.' };
      const severance = n * this.dailyWage(biz) * 2;
      biz.staff -= n; S.cash -= severance;
      this._dropTrainees(biz, n);
      return { ok: true, severance };
    }
    _dropTrainees(biz, n) { // trainees leave first
      let left = n; const keep = [];
      for (const t of (biz.trainees || [])) { if (left >= t.n) { left -= t.n; continue; } if (left > 0) { t.n -= left; left = 0; } keep.push(t); }
      biz.trainees = keep;
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
      const lock = this.upgradeLock(biz, uid);
      if (lock) return { ok: false, msg: lock + '.' };
      if (S.cash < cost) return { ok: false, msg: 'Not enough cash.' };
      S.cash -= cost; biz.upgrades[uid]++; biz.upgradesPaid += cost; S.stats.upgradesBought++;
      const inst = UPGRADES[uid].instant;
      if (inst && inst.rep) biz.rep = clamp(biz.rep + inst.rep, 0, 100);
      this.emit('upgrade', { biz, uid, level: biz.upgrades[uid] });
      this._checkAchievements();
      return { ok: true };
    }
    buyHqUpgrade(id) {
      const S = this.S;
      const cost = this.hqCost(id);
      if (cost === null) return { ok: false, msg: 'Max level reached.' };
      const lock = this.hqLock(id);
      if (lock) return { ok: false, msg: lock + '.' };
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
      if (S.marginDays >= ECONOMY.marginCallDays) return { ok: false, msg: 'The bank will not lend while your debt exceeds your credit line.' };
      const rate = this.currentRate();
      S.loans.push({ id: S.nextLoanId++, amount, principal: amount, rate, day: S.day, due: S.day + ECONOMY.loanTerm, paidInterest: 0 });
      S.cash += amount; S.stats.loansTaken++;
      this.log('🏦', `Borrowed ${this.fmt(amount)} at ${(rate * 100).toFixed(2)}%/day, due in ${ECONOMY.loanTerm} days.`, 'neutral');
      this.emit('loan', { amount });
      this._checkAchievements();
      return { ok: true };
    }
    // Roll a loan into a fresh 90-day term at today's rate, for a 1% fee.
    refinanceLoan(loanId) {
      const S = this.S, loan = S.loans.find(l => l.id === loanId);
      if (!loan) return { ok: false };
      if (S.marginDays >= ECONOMY.marginCallDays) return { ok: false, msg: 'Not while the bank is calling your debt.' };
      const fee = Math.round(loan.amount * 0.01);
      if (S.cash < fee) return { ok: false, msg: `Needs ${this.fmt(fee)} in cash for the fee.` };
      S.cash -= fee; S.lastDay.other -= fee;
      loan.rate = this.currentRate(); loan.day = S.day; loan.due = S.day + ECONOMY.loanTerm;
      this.log('🏦', `Refinanced a ${this.fmt(loan.amount)} loan for ${this.fmt(fee)}. New due date in ${ECONOMY.loanTerm} days.`, 'neutral');
      return { ok: true, fee };
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
    buyShares(compId, dollars, discount = 0) {
      const S = this.S, c = this._comp(compId);
      if (!c || c.acquired || c.bust) return { ok: false, msg: 'That stock is not trading.' };
      if (S.cash <= 0) return { ok: false, msg: 'Not enough cash.' };
      dollars = Math.min(Math.floor(dollars), Math.floor(S.cash));
      if (dollars < 10) return { ok: false, msg: 'Not enough cash.' };
      const price = this.sharePrice(compId, 'buy') * (1 - discount);
      const shares = dollars / price;
      const pos = S.portfolio[compId] || (S.portfolio[compId] = { shares: 0, cost: 0 });
      pos.shares += shares; pos.cost += dollars;
      S.cash -= dollars;
      return { ok: true, shares };
    }
    sellShares(compId, shares) {
      const S = this.S, c = this._comp(compId), pos = S.portfolio[compId];
      if (!c || !pos || pos.shares <= 0) return { ok: false };
      shares = Math.min(shares, pos.shares);
      const price = c.bust ? 0 : this.sharePrice(compId, 'sell');
      const gross = shares * price;
      const costPart = pos.cost * (shares / pos.shares);
      const profit = gross - costPart;
      pos.shares -= shares; pos.cost -= costPart;
      if (pos.shares < 1e-6) delete S.portfolio[compId];
      S.cash += gross;
      S.stats.tradingProfit += profit;
      this._checkAchievements();
      return { ok: true, proceeds: gross, profit };
    }
    acquireCompetitor(compId) {
      const S = this.S, c = this._comp(compId), def = this.compDef(compId);
      if (!this.canAcquire(compId)) return { ok: false, msg: 'You cannot afford this acquisition yet.' };
      const price = this.acquisitionPrice(compId);
      // cash out any shares first at the mid price
      if (S.portfolio[compId]) this.sellShares(compId, S.portfolio[compId].shares);
      S.cash -= price;
      c.acquired = true; c.priceWar = 0;
      S.subsidiaries.push({ id: compId, name: def.name, icon: def.icon, value: c.value, income: 0, health: 1, integration: ECONOMY.integrationDays });
      S.stats.acquisitions++;
      this.log('🤝', `${S.company} acquires ${def.name} for ${this.fmt(price)}. Integration will cost money for ${ECONOMY.integrationDays} days.`, 'good');
      this.emit('acquired', { name: def.name, icon: def.icon, price });
      this._checkAchievements();
      return { ok: true };
    }
    // Subsidiaries decay unless you put money back in.
    investSubsidiary(compId) {
      const S = this.S, sub = S.subsidiaries.find(s => s.id === compId);
      if (!sub) return { ok: false };
      const cost = this.subInvestCost(sub);
      if (S.cash < cost) return { ok: false, msg: 'Not enough cash.' };
      S.cash -= cost; S.lastDay.other -= cost;
      sub.health = 1; sub.value *= 1.03;
      this.log('🔧', `Reinvested ${this.fmt(cost)} in ${sub.name}. It is back at full strength.`, 'good');
      return { ok: true, cost };
    }

    // ---------- timed offers -----------------------------------------------------------
    offerFee(o) { return o.fee; }
    _spawnOffer(force = false) {
      const S = this.S;
      if (!force && S.offers.length >= ECONOMY.maxOffers) return null;
      if (force && S.offers.length >= ECONOMY.maxOffers) S.offers.shift();
      const eligible = OFFER_TEMPLATES.filter(t => (t.minDay || 0) <= S.day && !S.offers.some(o => o.tid === t.id));
      if (!eligible.length) return null;
      const t = weightedPick(eligible, x => x.w);
      const o = { id: S.nextOfferId++, tid: t.id, icon: t.icon, title: t.title, created: S.day, expires: S.day + t.days, data: {} };
      const bizList = S.businesses;
      switch (t.id) {
        case 'distressed': {
          const types = TYPE_ORDER.filter(x => S.unlocked[x]);
          const type = types[Math.min(types.length - 1, Math.max(0, types.length - 1 - Math.floor(rand() * 2)))];
          o.data.type = type; o.fee = Math.round(this.bizCost(type) * rnd(0.45, 0.62));
          o.desc = t.desc.replace('{type}', BUSINESS_TYPES[type].name).replace('{fee}', this.fmt(o.fee));
          break;
        }
        case 'bulk_lot': {
          if (!bizList.length) return null;
          const b = pick(bizList), pid = pick(BUSINESS_TYPES[b.type].products);
          const exp = Math.max(1, this.expectedDemand(b, pid));
          const qty = Math.max(2, Math.ceil(exp * rnd(6, 12)));
          const unit = this.buyCost(pid, b) * 0.6;
          o.data.bizId = b.id; o.data.pid = pid; o.data.qty = qty; o.data.unit = unit; o.fee = Math.round(qty * unit);
          o.desc = t.desc.replace('{qty}', qty.toLocaleString()).replace('{product}', PRODUCTS[pid].name).replace('{fee}', this.fmt(o.fee)).replace('{biz}', b.name);
          break;
        }
        case 'block_trade': {
          const alive = COMPETITORS.filter((d, i) => !S.competitors[i].acquired && !S.competitors[i].bust);
          if (!alive.length) return null;
          const def = pick(alive); o.data.rival = def.id; o.fee = Math.round(Math.max(500, S.valuation * 0.05));
          o.desc = t.desc.replace('{rival}', def.name).replace('{fee}', this.fmt(o.fee));
          break;
        }
        case 'star_manager': {
          const cands = bizList.filter(b => !b.manager);
          if (!cands.length) return null;
          const b = pick(cands); o.data.bizId = b.id; o.fee = Math.round(Math.max(400, b.paid * 0.25));
          o.desc = t.desc.replace('{biz}', b.name).replace('{fee}', this.fmt(o.fee));
          break;
        }
      }
      S.offers.push(o);
      this.log(o.icon, `${o.title}: ${o.desc} (${t.days} days)`, 'neutral');
      this.emit('offer', { offer: o });
      return o;
    }
    acceptOffer(id) {
      const S = this.S, o = S.offers.find(x => x.id === id);
      if (!o) return { ok: false, msg: 'That offer is gone.' };
      if (S.cash < o.fee) return { ok: false, msg: `Needs ${this.fmt(o.fee)} in cash.` };
      let msg = '';
      switch (o.tid) {
        case 'distressed': {
          const T = BUSINESS_TYPES[o.data.type];
          S.cash -= o.fee;
          const biz = this._makeBusiness(o.data.type, o.fee);
          biz.rep = 30; biz.autoRestock = true;
          S.businesses.push(biz); S.stats.bizBought++;
          msg = `Bought a distressed ${T.name} for ${this.fmt(o.fee)}. Restock it and rebuild its reputation.`;
          this.emit('bizBought', { biz });
          break;
        }
        case 'bulk_lot': {
          const b = this.biz(o.data.bizId); if (!b) return { ok: false, msg: 'That business no longer exists.' };
          const cap = this.capacity(b, o.data.pid) - b.stock[o.data.pid];
          const qty = Math.min(o.data.qty, Math.max(0, cap));
          if (qty <= 0) return { ok: false, msg: 'No room in storage for the lot.' };
          const cost = Math.round(qty * o.data.unit);
          S.cash -= cost;
          const prev = b.stock[o.data.pid];
          b.avgCost[o.data.pid] = (prev * b.avgCost[o.data.pid] + qty * o.data.unit) / (prev + qty);
          b.stock[o.data.pid] += qty;
          msg = `${qty.toLocaleString()} units of ${PRODUCTS[o.data.pid].name} delivered to ${b.name} for ${this.fmt(cost)}${qty < o.data.qty ? ' (storage limited the lot)' : ''}.`;
          break;
        }
        case 'block_trade': {
          const r = this.buyShares(o.data.rival, o.fee, 0.25);
          if (!r.ok) return r;
          msg = `Bought ${this.compDef(o.data.rival).name} shares at a 25% discount.`;
          break;
        }
        case 'star_manager': {
          const b = this.biz(o.data.bizId); if (!b) return { ok: false, msg: 'That business no longer exists.' };
          S.cash -= o.fee; b.manager = true;
          msg = `A star manager now runs ${b.name}.`;
          break;
        }
      }
      S.offers = S.offers.filter(x => x.id !== id);
      S.stats.offersTaken++;
      this.log(o.icon, msg, 'good');
      this.emit('offerTaken', { offer: o, msg });
      this._checkAchievements();
      return { ok: true, msg };
    }
    declineOffer(id) { this.S.offers = this.S.offers.filter(x => x.id !== id); return { ok: true }; }
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
        if (ins.sellOut) {
          S.cash += param.fee; S.flags.soldOut = true; S.flags.won = true;
          this.log('🦈', `${S.company} was sold to ${param.rivalName} for ${this.fmt(param.fee)}.`, 'neutral');
          this.emit('soldOut', { fee: param.fee, rival: param.rivalName });
        }
      }
      if (choice.fx) S.events.active.push({ id: def.id, title: def.title, icon: def.icon, kind: 'choice', days: choice.dur || 10, fx: choice.fx, param });
      if (def.id === 'hostile_bid' && !choice.instant) S.raid = { rival: param.rivalName, days: choice.dur || 30, startValue: S.valuation };
      const msg = this._fill(choice.msg, param);
      this.log(def.icon, msg, 'neutral');
      this.emit('choiceResolved', { msg, icon: def.icon });
      return { ok: true, msg };
    }

    // ---------- the daily tick ---------------------------------------------------------
    tick() {
      const S = this.S;
      if (S.flags.bankrupt || S.flags.sprintDone) return;
      if (S.events.pending) { // waiting for the player's decision
        if (EVENTS.find(e => e.id === S.events.pending.id)) return;
        S.events.pending = null; // unknown event from an older build: drop it
      }
      rngState = S.seed != null ? S.rngState : null;
      S.day++;
      if (this.yearDay() === 1) { S.year.startValue = S.valuation; S.year.startProfit = S.stats.totalProfit; }
      const fx = this._fx = this.activeEffects();
      const day = { revenue: 0, cogs: 0, wages: 0, rent: 0, marketing: 0, overhead: 0, upkeep: 0, hqUpkeep: 0, interest: 0, tax: 0,
        other: 0, pretax: 0, profit: 0, units: 0, subsidiaries: 0, spoilage: 0, fees: 0, levy: 0 };

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
      // Loans are interest-only for their term, then the bank collects the principal in
      // equal daily instalments over the next month. Refinance before the term to reset it.
      for (const loan of [...S.loans]) {
        if (loan.due == null) loan.due = loan.day + ECONOMY.loanTerm;
        if (S.day === loan.due - 10) this.emit('loanDueSoon', { loan, days: 10 });
        if (S.day >= loan.due) {
          if (S.day === loan.due) { loan.instalment = loan.amount / ECONOMY.loanAmortDays; this.log('🏦', `Loan of ${this.fmt(loan.amount)} reached its term. The bank now collects ${this.fmt(loan.instalment)} a day for ${ECONOMY.loanAmortDays} days.`, 'neutral'); this.emit('loanDue', { loan }); }
          const pay = Math.min(loan.amount, loan.instalment || loan.amount / ECONOMY.loanAmortDays);
          loan.amount -= pay; S.cash -= pay; S.stats.loansRepaid += pay; day.repaid = (day.repaid || 0) + pay;
          if (loan.amount <= 0.5) { S.loans = S.loans.filter(l => l.id !== loan.id); this.log('🏦', 'A loan was fully repaid.', 'good'); }
        }
      }
      // Margin call: debt well above the credit line for three days gets called in. The
      // bank only takes cash you actually have; while you stay in breach it charges a
      // penalty rate and lends nothing, and after 30 days in breach it sells a business.
      const limit = this.creditLimit(fx), debt = this.totalDebt();
      if (debt > limit * ECONOMY.marginHeadroom && debt > 0 && S.day > 60) {
        S.marginDays++;
        if (S.marginDays === 1) this.emit('marginWarning', { excess: debt - limit, days: ECONOMY.marginCallDays });
        if (S.marginDays === ECONOMY.marginCallDays && S.perks && S.perks.shield && !S.waived.margin) {
          S.waived.margin = true; S.marginDays = -30; // a month of grace
          this.log('🛡️', 'Crisis Playbook: the bank waived its margin call and gave you 30 days.', 'good');
        } else if (S.marginDays >= ECONOMY.marginCallDays) {
          const penalty = debt * ECONOMY.marginPenalty; S.cash -= penalty; day.interest += penalty;
          const floor = this._dailyFixedCosts(fx) * ECONOMY.marginCashFloor;
          let excess = Math.min(debt - limit, Math.max(0, S.cash - floor));
          let called = 0;
          for (const loan of [...S.loans]) { if (excess <= 0) break; const pay = Math.min(loan.amount, excess); loan.amount -= pay; excess -= pay; called += pay; S.cash -= pay; S.stats.loansRepaid += pay; if (loan.amount <= 0.5) S.loans = S.loans.filter(l => l.id !== loan.id); }
          if (S.marginDays === ECONOMY.marginCallDays) {
            S.stats.marginCalls++;
            S.sentiment = Math.max(ECONOMY.sentimentMin, S.sentiment - 0.05);
            this.log('🚨', `Margin call: the bank took ${this.fmt(called)} of cash against your debt and is charging a penalty rate until you are back inside your credit line.`, 'bad');
            this.emit('marginCall', { amount: called, penalty });
          }
          if (S.marginDays >= ECONOMY.marginCallDays + 30 && S.businesses.length > 1) {
            const weakest = [...S.businesses].sort((a, b) => this.bizProfitEstimate(a) - this.bizProfitEstimate(b))[0];
            const value = this.bizSaleValue(weakest);
            S.businesses = S.businesses.filter(b => b.id !== weakest.id); S.cash += value;
            let left = value; for (const loan of [...S.loans]) { if (left <= 0) break; const pay = Math.min(loan.amount, left); loan.amount -= pay; left -= pay; S.cash -= pay; S.stats.loansRepaid += pay; if (loan.amount <= 0.5) S.loans = S.loans.filter(l => l.id !== loan.id); }
            S.marginDays = ECONOMY.marginCallDays;
            this.log('🏷️', `The bank forced the sale of ${weakest.name} for ${this.fmt(value)} to cover your debt.`, 'bad');
            this.emit('forcedSale', { biz: weakest, value });
          }
        }
      } else if (S.marginDays > 0) { if (S.marginDays >= ECONOMY.marginCallDays) this.log('🏦', 'You are back inside your credit line. Penalty rate lifted.', 'good'); S.marginDays = 0; }
      else if (S.marginDays < 0) S.marginDays++;
      // Subsidiaries: pay to integrate, then earn according to health, which decays.
      for (const sub of S.subsidiaries) {
        if (sub.health == null) { sub.health = 1; sub.integration = 0; }
        if (sub.integration > 0) { sub.integration--; sub.income = -sub.value * ECONOMY.integrationCost; if (sub.integration === 0) this.log(sub.icon, `${sub.name} is fully integrated and now pays its way.`, 'good'); }
        else { sub.health = Math.max(0.15, sub.health - ECONOMY.subDecay); sub.income = sub.value * ECONOMY.subIncome * sub.health; sub.value *= 1 + 0.0006 * sub.health; }
        day.subsidiaries += sub.income;
      }
      S.cash += day.subsidiaries;
      day.hqUpkeep = this.hqUpkeep();
      S.cash -= day.hqUpkeep;
      day.pretax = day.revenue - day.cogs - day.wages - day.rent - day.marketing - day.spoilage
        - day.overhead - day.upkeep - day.hqUpkeep - day.interest + day.subsidiaries;
      // Corporate tax, with losses carried forward against future profit.
      if (day.pretax > 0) {
        const offset = Math.min(S.taxLossCarry || 0, day.pretax);
        S.taxLossCarry = (S.taxLossCarry || 0) - offset;
        day.tax = (day.pretax - offset) * this.taxRate();
        S.cash -= day.tax;
        S.stats.taxPaid = (S.stats.taxPaid || 0) + day.tax;
      } else {
        S.taxLossCarry = (S.taxLossCarry || 0) - day.pretax;
      }
      day.profit = day.pretax - day.tax;
      // push the tax back onto each business so the ledger reconciles
      let profitable = 0;
      for (const b of S.businesses) if (b.last.pretax > 0) profitable += b.last.pretax;
      for (const b of S.businesses) {
        b.last.tax = profitable > 0 && b.last.pretax > 0 ? day.tax * (b.last.pretax / profitable) : 0;
        b.last.net = b.last.pretax - b.last.tax;
        b.history.push(b.last.net); if (b.history.length > 60) b.history.shift();
      }
      // 4. market dynamics
      this._updateMarket(fx);
      // 5. events
      this._tickEvents(fx);
      // 6. competitors & ranking
      this._updateCompetitors(fx);
      // 7. valuation & history
      S.ema7 = S.ema7 === 0 && S.day === 1 ? day.profit : S.ema7 + (day.profit - S.ema7) * (2 / 8);
      S.ema30 = S.ema30 === 0 && S.day === 1 ? day.profit : S.ema30 + (day.profit - S.ema30) * (2 / 31);
      // A broken profit streak spooks investors.
      if (day.profit > 0) { S.streak++; S.stats.bestStreak = Math.max(S.stats.bestStreak, S.streak); }
      else { if (S.streak >= 10) { S.sentiment = Math.max(ECONOMY.sentimentMin, S.sentiment - ECONOMY.streakBreak); this.emit('streakBroken', { streak: S.streak }); } S.streak = 0; }
      this._computeValuation();
      // Year-end levy: a lump sum on company value, due on the last day of the year.
      if (this.yearDay() === DAYS_PER_YEAR && S.day > 1) {
        const levy = this.levyDue();
        if (levy > 0) {
          const before = S.cash;
          S.cash -= levy; day.levy = levy; day.other -= levy; S.stats.levyTotal += levy;
          if (before >= levy) S.stats.leviesPaid++;
          this.log('🧾', `Year-end levy of ${this.fmt(levy)} paid${S.cash < 0 ? ' — it pushed you into overdraft' : ''}.`, S.cash < 0 ? 'bad' : 'neutral');
        }
        const y = Math.floor((S.day - 1) / DAYS_PER_YEAR) + 1;
        const report = { year: y, startValue: S.year.startValue, endValue: S.valuation, profit: S.stats.totalProfit - S.year.startProfit, levy, businesses: S.businesses.length };
        const g = report.startValue > 0 ? report.endValue / report.startValue : 1;
        report.grade = g >= 8 ? 'A+' : g >= 4 ? 'A' : g >= 2.5 ? 'B' : g >= 1.5 ? 'C' : g >= 1 ? 'D' : 'F';
        this.log('📅', `Year ${y} report: value ${this.fmt(report.startValue)} → ${this.fmt(report.endValue)}. Grade ${report.grade}.`, 'neutral');
        this.emit('annualReport', report);
      } else if (this.daysToLevy() === 15 && S.day > 30) this.emit('levySoon', { amount: this.levyDue(), days: 15 });
      // overdraft handling
      if (S.cash < 0) {
        S.overdraftDays++;
        const fee = Math.max(1, -S.cash * 0.01);
        S.cash -= fee; day.fees += fee; day.other -= fee;
        if (S.overdraftDays === 1) this.emit('overdraft', { days: OVERDRAFT_LIMIT_DAYS });
        else if (S.overdraftDays === OVERDRAFT_LIMIT_DAYS - 3) this.emit('overdraftWarning', { left: 3 });
      } else S.overdraftDays = 0;
      // Near miss: living on under two days of cash, then pulling out of it.
      const rw = this.runway();
      if (S.cash > 0 && rw < 2) S.lowRunwayDays++;
      else if (S.lowRunwayDays >= 3 && rw >= 5) {
        const bonus = Math.round(Math.max(500, S.valuation * ECONOMY.closeCallBonus));
        const lowDays = S.lowRunwayDays;
        S.cash += bonus; day.other += bonus; S.stats.closeCalls++; S.lowRunwayDays = 0;
        this.log('😅', `Close call! You clawed back from ${lowDays} days on fumes. Investors reward the nerve: +${this.fmt(bonus)}.`, 'good');
        this.emit('closeCall', { bonus });
      } else if (rw >= 5) S.lowRunwayDays = 0;
      S.lastDay = day;
      S.stats.totalRevenue += day.revenue; S.stats.totalProfit += day.profit; S.stats.unitsSold += day.units;
      S.stats.peakValue = Math.max(S.stats.peakValue, S.valuation);
      S.stats.bestDayProfit = Math.max(S.stats.bestDayProfit || 0, day.profit);
      for (const m of [1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10]) if (!S.stats.milestones[m] && S.valuation >= m) S.stats.milestones[m] = S.day;
      this._updateRank();
      this._pushHistory();
      // 8. progression systems
      this._tickOffers();
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
      if (S.challenge && S.day >= DAILY.days && !S.flags.sprintDone) {
        S.flags.sprintDone = true;
        this.log('⏱️', `${DAILY.name} over: ${S.company} is worth ${this.fmt(S.valuation)}.`, 'good');
        this.emit('sprintDone', { valuation: S.valuation });
      }
      if (!S.flags.won && !S.challenge && S.valuation >= S.winValue) {
        S.flags.won = true;
        this.log('🏆', `${S.company} is worth ${this.fmt(S.winValue)}!`, 'good');
        this.emit('win', {});
      }
      this.emit('day', { day: S.day, summary: day });
      this._fx = null;
      if (S.seed != null) S.rngState = rngState;
      rngState = null;
      return day;
    }
    _tickOffers() {
      const S = this.S;
      const keep = [];
      for (const o of S.offers) { if (S.day >= o.expires) { this.log(o.icon, `${o.title} expired.`, 'neutral'); this.emit('offerExpired', { offer: o }); } else keep.push(o); }
      S.offers = keep;
      if (S.day >= 10 && rand() < ECONOMY.offerChance) this._spawnOffer();
    }

    _autoRestock(biz, fx) {
      const S = this.S;
      const T = BUSINESS_TYPES[biz.type];
      for (const pid of T.products) {
        const expected = Math.max(biz.last.expected[pid] || 0, this.expectedDemand(biz, pid, biz.prices[pid], fx));
        const target = Math.min(this.capacity(biz, pid), Math.ceil(expected * biz.stockDays * 1.1));
        const need = target - biz.stock[pid];
        if (need <= 0) continue;
        // never spend the last of the cash on auto-restock: keep a reserve of one day of wages & rent company-wide
        const reserve = this._dailyFixedCosts(fx);
        const unit = this.buyCost(pid, biz);
        let spendable = S.cash - reserve;
        // Supplier credit: when cash is short but the credit line is open, the bank fronts
        // the stock as a loan. Empty shelves kill companies; interest merely hurts.
        if (spendable < need * unit && biz.supplierCredit !== false) {
          const short = Math.min(need * unit - Math.max(0, spendable), this.availableCredit());
          if (short >= 100 && S.loans.length < MAX_LOANS && S.marginDays < ECONOMY.marginCallDays) {
            const existing = S.loans.find(l => l.supplier && l.day === S.day);
            if (existing) { existing.amount += short; existing.principal += short; S.cash += short; }
            else { S.loans.push({ id: S.nextLoanId++, amount: short, principal: short, rate: this.currentRate(), day: S.day, due: S.day + ECONOMY.loanTerm, paidInterest: 0, supplier: true }); S.cash += short; S.stats.loansTaken++; if (!S.supplierNoted) { S.supplierNoted = true; this.log('🏦', 'Cash ran short, so the bank fronted stock on supplier credit. It is a loan like any other.', 'neutral'); } }
            spendable = S.cash - reserve;
          }
        }
        const qty = Math.min(need, Math.floor(spendable / unit));
        if (qty > 0) this.buyInventory(biz.id, pid, qty, true);
      }
    }
    _dailyFixedCosts(fx) {
      let c = this.hqUpkeep();
      for (const b of this.S.businesses) {
        c += BUSINESS_TYPES[b.type].rent + b.staff * this.dailyWage(b, fx) + b.marketing + this.bizOverhead(b) + this.bizUpkeep(b);
      }
      return c;
    }

    _simulateBusiness(biz, fx, day) {
      const S = this.S, T = BUSINESS_TYPES[biz.type];
      const last = { revenue: 0, cogs: 0, wages: 0, rent: T.rent, marketing: biz.marketing, overhead: this.bizOverhead(biz), upkeep: this.bizUpkeep(biz),
        pretax: 0, tax: 0, net: 0, profit: 0, sold: {}, expected: {}, lostStock: 0, lostStaff: 0, serviceRatio: 1, units: 0, spoiled: 0, demandUnits: 0 };
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
          const spoiled = stochRound(biz.stock[pid] * ECONOMY.spoilRate * this.bizEffMul(biz, 'spoilMult'));
          if (spoiled > 0) { biz.stock[pid] -= spoiled; last.spoiled += spoiled * biz.avgCost[pid]; }
        }
      }
      last.lostStaff = total - total * service;
      last.demandUnits = total;
      last.wages = biz.staff * this.dailyWage(biz, fx);
      last.pretax = last.revenue - last.cogs - last.wages - last.rent - last.marketing - last.spoiled - last.overhead - last.upkeep;
      last.profit = last.pretax;   // tax is allocated once the company total is known
      // staff: trainees graduate, and underpaid people quit
      biz.trainees = (biz.trainees || []).filter(t => --t.days > 0 && t.n > 0);
      if (biz.staff > 0) {
        const quit = stochRound(biz.staff * this.quitRate(biz));
        if (quit > 0) { biz.staff -= quit; this._dropTrainees(biz, quit); S.stats.staffQuit += quit; last.quit = quit; if (quit >= Math.max(2, biz.staff * 0.2)) this.emit('staffQuit', { biz, n: quit }); }
      }
      // reputation: drifts back toward 50 and has to be earned above it
      const stockoutFrac = unitsWanted > 0 ? last.lostStock / unitsWanted : 0;
      const staffFrac = 1 - service;
      const avgRatio = ratioSum / T.products.length;
      let delta = biz.rep < 50 ? 0.25 : -0.1 * (biz.rep - 50) / 50 - 0.04;
      if (stockoutFrac < 0.06 && service >= 0.92 && avgRatio <= ECONOMY.repGougeAt) delta += 0.4;
      if (avgRatio < 0.95) delta += 0.15;
      delta -= 3 * stockoutFrac + 3 * staffFrac;
      if (avgRatio > ECONOMY.repGougeAt) delta -= (avgRatio - ECONOMY.repGougeAt) * 2.5;
      if (biz.staff === 0) delta -= 0.5;
      if (this.priceWarIn(biz.type)) delta -= 0.3;
      if (biz.manager) delta += 0.1;
      biz.rep = clamp(biz.rep + delta, this.repFloor(biz), 100);
      // apply to company
      S.cash += last.revenue - last.wages - last.rent - last.marketing - last.overhead - last.upkeep;
      day.revenue += last.revenue; day.cogs += last.cogs; day.wages += last.wages; day.rent += last.rent;
      day.marketing += last.marketing; day.overhead += last.overhead; day.upkeep += last.upkeep;
      day.units += last.units; day.spoilage += last.spoiled;
      biz.last = last;
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
        if (e.special || !e.w) return false;
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
      return text.replace('{product}', param.productName || '').replace('{biz}', param.bizName || '').replace('{cat}', param.catName || '').replace('{rival}', param.rivalName || '').replace('{fee}', param.fee != null ? this.fmt(param.fee) : '');
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
        if (ins.staffLossPct && param.bizId) { const b = this.biz(param.bizId); const n = Math.floor(b.staff * ins.staffLossPct * legal); if (n > 0) { b.staff -= n; this._dropTrainees(b, n); S.stats.staffQuit += n; } }
        if (ins.competitorPct) for (const c of S.competitors) if (!c.acquired) c.value *= (1 + ins.competitorPct);
      }
      if (def.dur > 0) S.events.active.push({ id: def.id, title: def.title, icon: def.icon, kind: def.kind, days: def.dur, fx: def.fx || {}, param });
      this.log(def.icon, `${def.title}: ${desc}`, def.kind === 'bad' ? 'bad' : def.kind === 'good' ? 'good' : 'neutral');
      this.emit('event', { def, param, desc });
    }

    _updateCompetitors(fx) {
      const S = this.S;
      const diff = DIFFICULTY[S.difficulty];
      const legacy = 1 + PRESTIGE.rivalPerLevel * (S.prestige || 0);
      const recession = S.events.active.some(e => e.id === 'recession');
      const boom = S.events.active.some(e => e.id === 'boom');
      // what the player owns most of, for rivals to pile into
      const counts = {}; for (const b of S.businesses) counts[b.type] = (counts[b.type] || 0) + 1;
      const topType = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      for (let i = 0; i < COMPETITORS.length; i++) {
        const def = COMPETITORS[i], c = S.competitors[i];
        if (c.acquired || c.bust) continue;
        // regime: normal drift, slumps, and rare busts
        if (c.slump > 0) c.slump--;
        else if (rand() < ECONOMY.rivalSlumpChance) { c.slump = Math.floor(rnd(20, 60)); this.log(def.icon, `${def.name} is in trouble: profit warning, shares sliding.`, 'neutral'); this.emit('rivalSlump', { name: def.name, icon: def.icon }); }
        let r = def.growth * ECONOMY.rivalDrift * diff.rivalGrowth * legacy + def.vol * gauss() + (S.sentiment - 1) * 0.03;
        if (c.slump > 0) r -= ECONOMY.rivalSlumpDrag;
        if (recession) r -= 0.004;
        if (boom) r += 0.002;
        if (rand() < ECONOMY.rivalBustChance) {
          const drop = rnd(0.3, 0.6); r -= drop;
          const pos = S.portfolio[def.id];
          if (c.value * (1 + r) < def.value * 0.15 && i < COMPETITORS.length - 1) {
            c.bust = true; c.value = 1000; c.priceWar = 0;
            if (pos) { S.stats.tradingProfit -= pos.cost; delete S.portfolio[def.id]; }
            this.log('💀', `${def.name} has collapsed. ${pos ? 'Your shares are worthless.' : 'One less rival.'}`, pos ? 'bad' : 'good');
            this.emit('rivalBust', { name: def.name, icon: def.icon, lost: pos ? pos.cost : 0 });
            continue;
          }
          this.log('💥', `${def.name} shares crash ${Math.round(drop * 100)}% on a scandal.`, pos ? 'bad' : 'neutral');
          this.emit('rivalCrash', { name: def.name, icon: def.icon, drop });
        }
        c.value = Math.max(1000, c.value * (1 + r));
        c.history.push(c.value); if (c.history.length > 120) c.history.shift();
        c.strength = clamp(Math.log10(c.value) / 8, 0.3, 1.6);
        // price wars: a rival in one of your sectors slashes prices for a while
        if (c.priceWar > 0) {
          c.priceWar--;
          if (c.priceWar === 0) {
            const won = S.ema7 > c.priceWarProfit;
            if (won) S.stats.priceWarsWon++;
            this.log('⚔️', `${def.name} ends its price war in ${BUSINESS_TYPES[c.priceWarType].name}s. ${won ? 'You held the line.' : 'It hurt.'}`, won ? 'good' : 'neutral');
            this.emit('priceWarEnd', { name: def.name, icon: def.icon, type: c.priceWarType, won });
            c.priceWarType = null; c.warCooldown = ECONOMY.priceWarCooldown;
          }
        } else if (c.warCooldown > 0) c.warCooldown--;
        else if (S.day > 90 && S.businesses.length >= 3 && rand() < ECONOMY.priceWarChance * diff.badEvents) {
          const mine = Object.keys(counts).filter(t => this.rivalInType(c, def, t));
          if (mine.length && !this.priceWarIn(mine[0])) {
            c.priceWarType = pick(mine); c.priceWar = Math.floor(rnd(12, 25)); c.priceWarProfit = S.ema7;
            this.log('⚔️', `${def.name} starts a price war in ${BUSINESS_TYPES[c.priceWarType].name}s! Match fair prices or lose customers for ${c.priceWar} days.`, 'bad');
            this.emit('priceWar', { name: def.name, icon: def.icon, type: c.priceWarType, days: c.priceWar });
          }
        }
        // expansion into whatever you own most of
        const nearTier = topType && def.types[0] !== '*' && def.types.some(t => Math.abs(BUSINESS_TYPES[t].tier - BUSINESS_TYPES[topType].tier) <= 2);
        if (topType && nearTier && S.day > 120 && S.businesses.length >= 5 && !this.rivalInType(c, def, topType) && c.value > S.valuation * 0.3 && rand() < ECONOMY.rivalExpandChance * diff.rivalGrowth) {
          c.extraTypes.push(topType);
          this.log(def.icon, `${def.name} opens a ${BUSINESS_TYPES[topType].name} chain across town. Competition in that sector just got tougher.`, 'bad');
          this.emit('rivalExpand', { name: def.name, icon: def.icon, type: topType });
        }
        if (c.value > S.valuation && rand() < 0.004) this.emit('taunt', { name: def.name, icon: def.icon, text: pick(def.taunts) });
      }
      // hostile takeover bid from a rival worth at least twice what you are
      if (!S.events.pending && !S.raid && S.day >= 90 && S.businesses.length >= 3 && S.valuation > 50000 && rand() < ECONOMY.hostileBidChance) {
        const big = COMPETITORS.map((d, i) => ({ d, c: S.competitors[i] })).filter(x => !x.c.acquired && !x.c.bust && x.c.value >= S.valuation * 2);
        if (big.length) {
          if (S.perks && S.perks.shield && !S.waived.hostile) { S.waived.hostile = true; this.log('🛡️', 'Crisis Playbook: your lawyers killed a hostile bid before it reached the board.', 'good'); }
          else {
            const x = pick(big), def = EVENTS.find(e => e.id === 'hostile_bid');
            const param = { rival: x.d.id, rivalName: x.d.name, fee: Math.round(S.valuation * 1.3) };
            const desc = def.desc.replace('{rival}', x.d.name).replace('{fee}', this.fmt(param.fee));
            S.stats.eventsSeen++;
            S.events.pending = { id: def.id, param, desc };
            this.emit('choice', { def, param, desc });
          }
        }
      }
      if (S.raid) {
        S.raid.days--;
        if (S.raid.days <= 0) { if (S.cash > 0 && !S.flags.bankrupt) { S.stats.raidsSurvived++; this.log('🛡️', `You survived ${S.raid.rival}'s raid.`, 'good'); this.emit('raidSurvived', { rival: S.raid.rival }); } S.raid = null; }
      }
    }
    ranking() {
      const S = this.S;
      const rows = [{ id: "you", name: S.company, icon: "🏢", value: S.valuation, you: true }];
      for (let i = 0; i < COMPETITORS.length; i++) {
        const c = S.competitors[i]; if (c.acquired || c.bust) continue;
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
      const subs = S.subsidiaries.reduce((a, s) => a + s.value * (s.health == null ? 1 : s.health), 0);
      const debt = this.totalDebt();
      const net = S.cash + inv + bizAssets + subs + this.portfolioValue() - debt;
      // sentiment: mean-reverting random walk + event pressure; panic can run deep
      const fx = this._fx || this.activeEffects();
      S.sentiment = clamp(S.sentiment + (1 - S.sentiment) * 0.03 + gauss() * 0.012 + fx.sentiment * 0.05, ECONOMY.sentimentMin, 1.5);
      S.jitter = clamp(S.jitter * 0.7 + gauss() * 0.008, -0.04, 0.04);
      const growth = clamp((S.ema7 - S.ema30) / Math.max(Math.abs(S.ema30), 50), -0.6, 0.6);
      const streakBonus = 1 + Math.min(ECONOMY.streakMax, S.streak / ECONOMY.streakDays);
      S.streakBonus = streakBonus;
      S.multiple = ECONOMY.multiple * S.sentiment * (1 + 0.5 * growth) * (1 + this.hqEff('multiple')) * streakBonus;
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
      const base = Math.max(300, S.valuation * 0.006, Math.max(0, S.ema30) * 5);
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
        s.hq = s.hq || {};
        if (s.hq.logistics != null && s.hq.procurement == null) s.hq.procurement = s.hq.logistics;  // renamed department
        for (const k in HQ_UPGRADES) if (!Number.isFinite(s.hq[k])) s.hq[k] = 0;
        for (const k in s.hq) if (!HQ_UPGRADES[k]) delete s.hq[k];
        if (!Number.isFinite(s.taxLossCarry)) s.taxLossCarry = 0;
        for (const pid in PRODUCTS) {
          if (!s.market[pid]) s.market[pid] = { cost: PRODUCTS[pid].cost, supply: 1, demand: 1, history: [PRODUCTS[pid].cost] };
          const m = s.market[pid];
          if (!Number.isFinite(m.cost) || m.cost <= 0) m.cost = PRODUCTS[pid].cost;
          if (!Number.isFinite(m.supply)) m.supply = 1; if (!Number.isFinite(m.demand)) m.demand = 1;
          if (!Array.isArray(m.history)) m.history = [m.cost];
        }
        s.businesses = s.businesses.filter(b => b && BUSINESS_TYPES[b.type]);
        for (const b of s.businesses) {
          b.upgrades = b.upgrades || {};
          for (const uid in UPGRADES) b.upgrades[uid] = clamp(Math.floor(b.upgrades[uid] || 0), 0, UPGRADES[uid].max);
          for (const uid in b.upgrades) if (!UPGRADES[uid]) delete b.upgrades[uid];
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
          if (!Array.isArray(b.trainees)) b.trainees = [];
          b.manager = !!b.manager;
        }
        // rivals, subsidiaries, loans and offers gained fields in the second economy pass
        for (const c of s.competitors) { if (!Array.isArray(c.extraTypes)) c.extraTypes = []; if (!Number.isFinite(c.slump)) c.slump = 0; if (!Number.isFinite(c.warCooldown)) c.warCooldown = 0; if (!Number.isFinite(c.priceWar)) c.priceWar = 0; if (c.priceWarType && !BUSINESS_TYPES[c.priceWarType]) { c.priceWarType = null; c.priceWar = 0; } c.bust = !!c.bust; }
        s.subsidiaries = (s.subsidiaries || []).filter(x => x && Number.isFinite(x.value));
        for (const sub of s.subsidiaries) { if (!Number.isFinite(sub.health)) sub.health = 1; if (!Number.isFinite(sub.integration)) sub.integration = 0; }
        for (const l of (s.loans || [])) if (!Number.isFinite(l.due)) l.due = (l.day || s.day || 0) + ECONOMY.loanTerm;
        if (!Array.isArray(s.offers)) s.offers = [];
        s.offers = s.offers.filter(o => o && OFFER_TEMPLATES.find(t => t.id === o.tid));
        if (!Number.isFinite(s.nextOfferId)) s.nextOfferId = 1;
        if (!s.perks || typeof s.perks !== 'object') s.perks = { seed: 0, analytics: 0, credit: 0, launch: 0, shield: 0 };
        if (!s.waived || typeof s.waived !== 'object') s.waived = { margin: false, hostile: false };
        if (!Number.isFinite(s.prestige)) s.prestige = 0;
        if (!Number.isFinite(s.winValue)) s.winValue = D.WIN_VALUE * Math.pow(PRESTIGE.targetGrowth, s.prestige);
        if (!Number.isFinite(s.marginDays)) s.marginDays = 0;
        if (!Number.isFinite(s.lowRunwayDays)) s.lowRunwayDays = 0;
        if (s.seed != null && !Number.isFinite(s.seed)) s.seed = null;
        if (s.seed == null) { s.seed = null; s.rngState = null; s.challenge = null; }
        if (!s.year || typeof s.year !== 'object') s.year = { startValue: s.valuation || 0, startProfit: 0, levy: 0 };
        if (s.raid && (!Number.isFinite(s.raid.days) || s.raid.days <= 0)) s.raid = null;
        const fresh = new Game(); fresh.newGame({ company: s.company, difficulty: s.difficulty in DIFFICULTY ? s.difficulty : 'normal' });
        const F = fresh.S;
        for (const k of ['stats', 'flags', 'lastDay', 'history', 'events']) { s[k] = s[k] || {}; for (const kk in F[k]) if (s[k][kk] == null) s[k][kk] = F[k][kk]; }
        if (!s.stats.milestones || typeof s.stats.milestones !== 'object') s.stats.milestones = {};
        for (const k of ['quests', 'loans', 'subsidiaries', 'eventLog']) if (!Array.isArray(s[k])) s[k] = [];
        for (const k of ['achievements', 'unlocked', 'portfolio']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
        for (const k of ['sentiment', 'jitter', 'valuation', 'sharePrice', 'netAssets', 'goodwill', 'multiple', 'ema7', 'ema30', 'streak', 'overdraftDays', 'questCooldown', 'rank', 'nextBizId', 'nextLoanId', 'day', 'cash']) if (typeof s[k] !== 'number' || !isFinite(s[k])) s[k] = F[k];
        if (!(s.difficulty in DIFFICULTY)) s.difficulty = 'normal';
        // Saves from before the tax/overhead/upkeep economy never budgeted for the new
        // daily bills. Hand over a restructuring grant so an old company is not killed
        // the moment it loads.
        if (s.econ !== 2 && s.econ !== 3) {
          s.econ = 2;
          this.S = s;
          let daily = this.hqUpkeep();
          for (const b of s.businesses) daily += this.bizUpkeep(b) + this.bizOverhead(b);
          const grant = Math.round(daily * 45);
          if (grant > 0) {
            s.cash += grant;
            s.eventLog.unshift({ day: s.day, icon: '🏛️', kind: 'good',
              text: `The economy has changed: corporate tax, head-office overhead and upgrade upkeep are now charged daily. A one-off restructuring grant of ${this.fmt(grant)} covers your first 45 days.` });
          }
        }
        if (s.econ === 2) {
          // Third economy pass: loans now have terms, so give old loans a fresh 90 days
          // from today, and hand over the first year-end levy as a warning rather than a bill.
          s.econ = 3;
          for (const l of s.loans) l.due = s.day + ECONOMY.loanTerm;
          s.eventLog.unshift({ day: s.day, icon: '🏛️', kind: 'neutral',
            text: 'The economy has changed again: loans now come due after 90 days, a year-end levy of 3% of company value is charged on day 360, reputation must be earned, staff can quit, rivals fight back, and the valuation multiple is lower. Your existing loans were reset to a fresh 90-day term.' });
        }
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
        if (S.cash < 0 || S.flags.bankrupt || S.flags.won || S.flags.sprintDone) break;
      }
      // Something to decide on the moment you are back.
      let offer = null;
      if (ran >= 5 && !S.flags.bankrupt) { rngState = S.seed != null ? S.rngState : null; offer = this._spawnOffer(true); if (S.seed != null) S.rngState = rngState; rngState = null; }
      this.listeners = silent;
      return { days: ran, cashDelta: S.cash - startCash, valueDelta: S.valuation - startVal, fromDay: startDay, offer };
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
