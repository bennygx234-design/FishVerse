/* =========================================================================
   MARKET MAYHEM — UI layer: views, bindings, toasts, modals, juice
   ========================================================================= */
(function (root) {
  'use strict';
  const D = root.MM_DATA, Charts = root.MM_CHARTS;
  const I = root.MM_ICONS || (() => '');
  const isSvg = v => typeof v === 'string' && v.charAt(0) === '<';
  const emo = v => isSvg(v) ? v : `<span class="emo">${v}</span>`;
  const { PRODUCTS, BUSINESS_TYPES, TYPE_ORDER, UPGRADES, UPGRADE_BRANCHES, HQ_UPGRADES, HQ_DEPTS, COMPETITORS, CATEGORIES, ACHIEVEMENTS, TIPS, DIFFICULTY, ECONOMY, PRESTIGE, DAILY } = D;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let G = null, H = null, fmt = n => '$' + n; // game, hooks, formatter

  // ============================================================================
  // Sound (tiny WebAudio synth)
  // ============================================================================
  const Sound = {
    ctx: null, muted: false,
    init() { try { this.muted = localStorage.getItem('mm_muted') === '1'; } catch (e) { /* ignore */ } },
    ensure() { if (!this.ctx) { try { this.ctx = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { this.ctx = null; } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    tone(freq, dur = 0.12, type = 'sine', vol = 0.18, delay = 0, slide = 0) {
      if (this.muted || !this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
    },
    play(name) {
      if (this.muted) return; this.ensure(); if (!this.ctx) return;
      switch (name) {
        case 'click': this.tone(600, 0.05, 'square', 0.05); break;
        case 'cash': this.tone(880, 0.08, 'sine', 0.15); this.tone(1320, 0.12, 'sine', 0.15, 0.06); break;
        case 'buy': this.tone(520, 0.08, 'triangle', 0.15); this.tone(780, 0.1, 'triangle', 0.15, 0.07); this.tone(1040, 0.14, 'triangle', 0.15, 0.14); break;
        case 'good': this.tone(660, 0.1, 'sine', 0.14); this.tone(990, 0.16, 'sine', 0.14, 0.08); break;
        case 'bad': this.tone(220, 0.25, 'sawtooth', 0.09, 0, -80); this.tone(160, 0.3, 'sawtooth', 0.09, 0.1, -60); break;
        case 'unlock': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.14, i * 0.09)); break;
        case 'achievement': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.14, i * 0.08)); break;
        case 'win': [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.16, i * 0.12)); break;
        case 'alarm': this.tone(440, 0.15, 'square', 0.08); this.tone(440, 0.15, 'square', 0.08, 0.25); break;
        case 'tick': this.tone(1200, 0.03, 'square', 0.04); break;
      }
    },
    toggle() { this.muted = !this.muted; try { localStorage.setItem('mm_muted', this.muted ? '1' : '0'); } catch (e) { /* ignore */ } return this.muted; },
  };

  // ============================================================================
  // Toasts, floaters, confetti, modal
  // ============================================================================
  function toast({ icon = '💬', title = '', desc = '', kind = '', ttl = 4500 }) {
    const box = $('#toasts'); if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = `${emo(icon)}<div><div class="t">${esc(title)}</div>${desc ? `<div class="d">${esc(desc)}</div>` : ''}</div>`;
    box.appendChild(el);
    const maxToasts = root.innerWidth <= 760 ? 2 : 3;
    while (box.children.length > maxToasts) box.removeChild(box.firstChild);
    const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
    el.addEventListener('click', kill);
    setTimeout(kill, ttl);
  }
  function floatAt(el, text, kind = 'good') {
    if (!el) return;
    const now = performance.now();
    if (el._lastFloat && now - el._lastFloat < 650) return;
    el._lastFloat = now;
    const r = el.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'floater ' + kind; f.textContent = text;
    f.style.left = (r.left + r.width * (0.3 + Math.random() * 0.4)) + 'px';
    f.style.top = (r.top + r.height * 0.4) + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }

  const Confetti = {
    parts: [], running: false,
    burst(n = 120, opts = {}) {
      const c = $('#confetti'); if (!c) return;
      if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      c.hidden = false;
      const w = c.clientWidth, h = c.clientHeight;
      const cx = opts.x != null ? opts.x : w / 2, cy = opts.y != null ? opts.y : h * 0.3;
      const colors = ['#2dd4bf', '#fbbf24', '#f472b6', '#a78bfa', '#34d399', '#60a5fa', '#ffffff'];
      if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * (opts.power || 9);
        this.parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, g: 0.25, life: 80 + Math.random() * 60, color: colors[i % colors.length], s: 4 + Math.random() * 5, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3 });
      }
      this.running = true;
    },
    frame() {
      if (!this.running) return;
      const c = $('#confetti'); if (!c) return;
      const dpr = 1; // particles do not need a retina buffer; keeps GPU memory low
      const w = root.innerWidth, h = root.innerHeight;
      const W = Math.max(1, Math.round(w * dpr)), Hh = Math.max(1, Math.round(h * dpr));
      if (c.width !== W || c.height !== Hh) { c.width = W; c.height = Hh; }
      const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      this.parts = this.parts.filter(p => p.life > 0 && p.y < h + 20);
      for (const p of this.parts) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.r += p.vr; p.life--;
        const cs = Math.cos(p.r), sn = Math.sin(p.r);
        ctx.setTransform(dpr * cs, dpr * sn, -dpr * sn, dpr * cs, dpr * p.x, dpr * p.y);
        ctx.globalAlpha = Math.min(1, p.life / 30); ctx.fillStyle = p.color; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
      if (!this.parts.length) { this.running = false; ctx.clearRect(0, 0, w, h); c.width = 1; c.height = 1; c.hidden = true; }
    },
  };

  const Modal = {
    open({ title = '', icon = '', body = '', actions = [], cls = '', wide = false, onClose = null }) {
      const m = $('#modal');
      m.innerHTML = `<div class="modal-box ${cls} ${wide ? 'wide' : ''}">
        ${title ? `<h2>${icon ? `<span class="ico">${icon}</span>` : ''}<span>${esc(title)}</span></h2>` : ''}
        <div class="modal-body">${body}</div>
        <div class="modal-actions">${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-mi="${i}">${a.icon ? I(a.icon, 16) : ''}${esc(a.label)}</button>`).join('')}</div>
      </div>`;
      m.classList.remove('hidden');
      m._actions = actions; m._onClose = onClose; m._locked = false; m._legacy = false;
      $$('[data-mi]', m).forEach(b => b.addEventListener('click', () => {
        const a = actions[+b.dataset.mi];
        Sound.play('click');
        if (a.fn) { const keep = a.fn(); if (keep === true) return; }
        Modal.close();
      }));
      UI.hydrateIcons(m);
      return m;
    },
    close() { const m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; m._locked = false; if (m._onClose) { const f = m._onClose; m._onClose = null; f(); } },
    isOpen() { return !$('#modal').classList.contains('hidden'); },
  };

  // ============================================================================
  // Helpers for rendering
  // ============================================================================
  const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
  const sign = n => (n >= 0 ? '+' : '');
  function deltaHtml(now, prev, invert = false) {
    if (prev == null || prev === 0) return '<span class="trend flat">—</span>';
    const d = (now - prev) / Math.abs(prev);
    const good = invert ? d <= 0 : d >= 0;
    return `<span class="trend ${good ? 'up' : 'down'}">${I(d >= 0 ? 'arrow-up' : 'arrow-down', 11)}${Math.abs(d * 100).toFixed(1)}%</span>`;
  }
  function dateLabel(day) { const y = Math.floor((day - 1) / 360) + 1, m = Math.floor(((day - 1) % 360) / 30) + 1, d = ((day - 1) % 30) + 1; return `Year ${y} · Month ${m} · Day ${d}`; }
  function levelDots(lvl, max) { let s = '<div class="lvl">'; for (let i = 0; i < max; i++) s += `<i class="${i < lvl ? 'on' : ''}"></i>`; return s + '</div>'; }
  function demandBadge(m) {
    if (m >= 1.4) return `<span class="badge gold">${I('flame', 12)}Hot</span>`;
    if (m >= 1.12) return `<span class="badge good">${I('arrow-up', 12)}High</span>`;
    if (m <= 0.7) return `<span class="badge bad">${I('arrow-down', 12)}Cold</span>`;
    if (m <= 0.88) return `<span class="badge bad">${I('arrow-down', 12)}Low</span>`;
    return '<span class="badge">Normal</span>';
  }
  function priceBadge(ratio) {
    if (ratio < 0.9) return '<span class="badge teal">Cheap</span>';
    if (ratio <= ECONOMY.repGougeAt) return '<span class="badge good">Fair</span>';
    if (ratio <= 1.4) return '<span class="badge gold">Pricey</span>';
    return '<span class="badge bad">Gouging</span>';
  }
  function moraleLabel(w) { const t = w >= 1.3 ? ['Thrilled', 'good'] : w >= 1.1 ? ['Happy', 'good'] : w >= 0.9 ? ['Content', ''] : w >= 0.7 ? ['Grumbling', 'bad'] : ['Angry', 'bad']; return `<span class="badge ${t[1]}">${t[0]}</span>`; }
  function sentimentLabel(s) { return s >= 1.15 ? 'Euphoric' : s >= 1.05 ? 'Optimistic' : s <= 0.7 ? 'Panicked' : s <= 0.95 ? 'Nervous' : 'Neutral'; }
  function runwayLabel(r) { return r === Infinity ? '∞' : r >= 100 ? '99+ days' : `${r.toFixed(1)} days`; }
  function tweenNumber(el, value, formatter) {
    const from = el._v == null ? value : el._v;
    el._v = value;
    if (from === value) { el.textContent = formatter(value); return; }
    const start = performance.now(), dur = 260;
    const step = now => {
      const t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 3);
      el.textContent = formatter(from + (value - from) * e);
      if (t < 1 && el._v === value) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function setText(sel, text, el) { const n = $(sel, el); if (n && n.textContent !== text) n.textContent = text; }
  function setHtml(sel, html, el) { const n = $(sel, el); if (n && n.innerHTML !== html) n.innerHTML = html; }
  function statGrid(rows) { return `<div class="stat-grid">${rows.map(([k, v, cls]) => `<div class="kv"><span>${k}</span><span class="v ${cls || ''}">${v}</span></div>`).join('')}</div>`; }

  // ============================================================================
  // UI object
  // ============================================================================
  const UI = {
    view: 'dashboard', detailBiz: null, rivalsTab: 'leaderboard', marketMine: true, chartRange: 90, chartLog: false,
    ledgerSort: { key: 'net', dir: -1 }, ledgerDay: -1,
    lastRefresh: 0, lastChart: 0, structKey: '', mountedView: '', navDots: {}, restockDays: 3, tipIndex: 0, lastTipDay: -100,

    // Replaces [data-icon] placeholders with inline SVG (keeps markup readable).
    hydrateIcons(scope) {
      $$('[data-icon]', scope || document).forEach(el => {
        const name = el.dataset.icon, size = +el.dataset.size || 20;
        if (el._icon === name + size) return;
        el._icon = name + size;
        el.innerHTML = I(name, size);
      });
    },
    setIcon(sel, name, size) { const el = $(sel); if (el) { el._icon = null; el.dataset.icon = name; if (size) el.dataset.size = size; UI.hydrateIcons(el.parentNode || document); } },

    init(game, hooks) {
      G = game; H = hooks; fmt = n => G.fmt(n);
      Sound.init();
      UI.hydrateIcons(document);
      $$('.navbtn').forEach(b => b.addEventListener('click', () => { Sound.play('click'); UI.showView(b.dataset.view); }));
      $('#speedCtl').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Sound.play('click'); H.setSpeed(+b.dataset.speed); UI.updateSpeedButtons(); });
      $('#btnMenu').addEventListener('click', () => { Sound.play('click'); UI.showMenu(); });
      $('#btnFeed').addEventListener('click', () => { Sound.play('click'); document.body.classList.toggle('feed-open'); const d = $('#btnFeed .dot'); if (d) d.remove(); });
      $('#btnFeedClose').addEventListener('click', () => document.body.classList.remove('feed-open'));
      $('#topRunway').addEventListener('click', () => UI.showView('bank'));
      const view = $('#view');
      view.addEventListener('click', e => UI.onClick(e));
      view.addEventListener('input', e => UI.onInput(e));
      view.addEventListener('change', e => UI.onChange(e));
      view.addEventListener('mousemove', e => { const c = e.target.closest('canvas[data-hover]'); if (c) { c._hover = e.offsetX; UI.lastChart = 0; } });
      view.addEventListener('mouseleave', () => { $$('canvas[data-hover]', view).forEach(c => { c._hover = null; }); UI.lastChart = 0; });
      $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('#modal')._locked) Modal.close(); });
      $('#modal').addEventListener('click', e => { const b = e.target.closest('[data-perk]'); if (b) { const r = H.buyPerk(b.dataset.perk); if (!r.ok) toast({ icon: I('circle-x', 20), title: r.msg, kind: 'bad', ttl: 2500 }); else { Sound.play('buy'); UI.showLegacy(); } } });
      game.on((type, p) => UI.onGameEvent(type, p));
    },

    // ---------- game events → feedback -------------------------------------------
    onGameEvent(type, p) {
      const S = G.S;
      const bad = (title, desc, ttl = 8000) => { toast({ icon: I('alert', 20), title, desc, kind: 'bad', ttl }); Sound.play('alarm'); };
      switch (type) {
        case 'log': UI.addFeed(p); break;
        case 'day':
          if (S.day % 5 === 0) H.save();
          if (H.getSpeed() === 1 && p.summary.profit !== 0 && UI.view === 'dashboard') floatAt($('#stat-cash'), `${sign(p.summary.profit)}${fmt(p.summary.profit)}`, p.summary.profit >= 0 ? 'good' : 'bad');
          break;
        case 'event': {
          const kind = p.def.kind === 'bad' ? 'bad' : p.def.kind === 'good' ? 'good' : '';
          toast({ icon: p.def.icon, title: p.def.title, desc: p.desc, kind, ttl: 7000 });
          Sound.play(kind === 'bad' ? 'bad' : 'good');
          if (p.param.cashDelta) floatAt($('#topCash'), `${sign(p.param.cashDelta)}${fmt(p.param.cashDelta)}`, p.param.cashDelta > 0 ? 'gold' : 'bad');
          break;
        }
        case 'eventEnd': toast({ icon: p.ev.icon, title: `${p.ev.title} is over`, ttl: 3000 }); break;
        case 'choice': H.pause(true); UI.showChoice(p); break;
        case 'choiceResolved': toast({ icon: p.icon, title: p.msg, ttl: 5000 }); break;
        case 'unlock': toast({ icon: BUSINESS_TYPES[p.type].icon, title: `Unlocked: ${BUSINESS_TYPES[p.type].name}`, desc: BUSINESS_TYPES[p.type].blurb, kind: 'gold', ttl: 8000 }); Sound.play('unlock'); UI.navDots.businesses = true; UI.updateNavDots(); break;
        case 'achievement': toast({ icon: p.a.icon, title: `Achievement: ${p.a.name}`, desc: p.a.desc + (p.a.bonus ? ` Reward: ${fmt(p.a.bonus)}` : ''), kind: 'purple', ttl: 8000 }); Sound.play('achievement'); Confetti.burst(60, { power: 6 }); if (p.a.bonus) floatAt($('#topCash'), `+${fmt(p.a.bonus)}`, 'gold'); break;
        case 'quest': toast({ icon: I('scroll', 20), title: 'Quest complete!', desc: `${p.q.text} — reward ${fmt(p.q.reward)}`, kind: 'gold', ttl: 7000 }); Sound.play('cash'); floatAt($('#topCash'), `+${fmt(p.q.reward)}`, 'gold'); break;
        case 'rankUp': toast({ icon: I('trophy', 20), title: p.passed ? `You overtook ${p.passed}!` : 'Rank up!', desc: `You are now #${p.rank} on the market leaderboard.`, kind: 'good', ttl: 6000 }); Sound.play('good'); break;
        case 'taunt': toast({ icon: p.icon, title: p.name, desc: p.text, ttl: 6000 }); break;
        case 'bigSale': toast({ icon: PRODUCTS[p.pid].icon, title: `${p.sold > 1 ? p.sold + '× ' : ''}${PRODUCTS[p.pid].name} sold!`, desc: `${p.biz.name} closed a deal worth ${fmt(p.price * p.sold)}.`, kind: 'good', ttl: 5000 }); Sound.play('cash'); break;
        case 'overdraft': bad('Overdraft!', `Cash is negative. Fix it within ${p.days} days or go bankrupt.`, 9000); $('#app').classList.add('shake'); setTimeout(() => $('#app').classList.remove('shake'), 600); break;
        case 'overdraftWarning': bad(`Bankruptcy in ${p.left} days!`, 'Sell inventory, sell a business, or take a loan now.', 9000); break;
        case 'bankrupt': H.pause(true); UI.showBankrupt(); break;
        case 'win': H.pause(true); UI.showWin(); break;
        case 'soldOut': H.pause(true); UI.showSoldOut(p); break;
        case 'sprintDone': H.pause(true); UI.showSprintDone(p); break;
        case 'bizBought': toast({ icon: BUSINESS_TYPES[p.biz.type].icon, title: `${p.biz.name} is open!`, desc: 'Auto-restock is on. Check staffing and prices.', kind: 'good', ttl: 6000 }); Sound.play('buy'); Confetti.burst(50, { power: 6 }); break;
        case 'bizSold': toast({ icon: I('tag', 20), title: `Sold ${p.biz.name}`, desc: `Received ${fmt(p.value)}.`, ttl: 5000 }); break;
        case 'acquired': toast({ icon: p.icon, title: `Acquired ${p.name}!`, desc: `A new subsidiary joins your empire for ${fmt(p.price)}. Integration costs run for ${ECONOMY.integrationDays} days.`, kind: 'gold', ttl: 8000 }); Sound.play('win'); Confetti.burst(150, { power: 10 }); break;
        case 'upgrade': Sound.play('buy'); break;
        case 'hqUpgrade': Sound.play('buy'); toast({ icon: HQ_UPGRADES[p.id].icon, title: `${HQ_UPGRADES[p.id].name} Lv.${p.level}`, desc: HQ_UPGRADES[p.id].desc, kind: 'good', ttl: 4000 }); break;
        case 'loan': Sound.play('cash'); break;
        // ---- new pressure systems ----
        case 'offer': toast({ icon: p.offer.icon, title: `${p.offer.title} · ${p.offer.expires - S.day}d`, desc: p.offer.desc, kind: 'gold', ttl: 9000 }); Sound.play('good'); UI.navDots.dashboard = UI.view !== 'dashboard'; UI.updateNavDots(); break;
        case 'offerTaken': toast({ icon: p.offer.icon, title: p.offer.title, desc: p.msg, kind: 'good', ttl: 6000 }); Sound.play('buy'); break;
        case 'offerExpired': toast({ icon: p.offer.icon, title: `${p.offer.title} expired`, ttl: 3500 }); break;
        case 'loanDueSoon': toast({ icon: I('bank', 20), title: `Loan term ends in ${p.days} days`, desc: `${fmt(p.loan.amount)} will be collected over the following ${ECONOMY.loanAmortDays} days. Refinance at the Bank to reset the term.`, kind: 'gold', ttl: 8000 }); break;
        case 'loanDue': toast({ icon: I('bank', 20), title: 'Loan term reached', desc: `The bank now collects ${fmt(p.loan.instalment)} a day.`, ttl: 6000 }); break;
        case 'marginWarning': bad('Debt exceeds your credit line', `Repay ${fmt(p.excess)} within ${p.days} days or the bank calls it.`, 9000); break;
        case 'marginCall': bad('Margin call', `The bank took ${fmt(p.amount)} and is charging a penalty rate until you are back inside your credit line.`, 9000); $('#app').classList.add('shake'); setTimeout(() => $('#app').classList.remove('shake'), 600); break;
        case 'forcedSale': bad('Forced sale', `The bank sold ${p.biz.name} for ${fmt(p.value)} to cover your debt.`, 9000); break;
        case 'levySoon': toast({ icon: '🧾', title: `Year-end levy in ${p.days} days`, desc: `About ${fmt(p.amount)} is due on the last day of the year. Keep the cash ready.`, kind: 'gold', ttl: 9000 }); break;
        case 'annualReport': UI.showAnnualReport(p); break;
        case 'priceWar': bad(`${p.name} starts a price war`, `${BUSINESS_TYPES[p.type].name}s lose customers for ${p.days} days unless your prices are at or below fair.`, 9000); break;
        case 'priceWarEnd': toast({ icon: p.icon, title: `${p.name} ends its price war`, desc: p.won ? 'Profit is up — you held the line.' : 'It hurt. Reset your prices.', kind: p.won ? 'good' : '', ttl: 6000 }); break;
        case 'rivalExpand': toast({ icon: p.icon, title: `${p.name} moves into ${BUSINESS_TYPES[p.type].name}s`, desc: 'More competition in that sector from now on.', kind: 'bad', ttl: 7000 }); Sound.play('bad'); break;
        case 'rivalSlump': toast({ icon: p.icon, title: `${p.name} issues a profit warning`, desc: 'Their shares are sliding. Cheap, or a falling knife?', ttl: 6000 }); break;
        case 'rivalCrash': toast({ icon: p.icon, title: `${p.name} crashes ${Math.round(p.drop * 100)}%`, ttl: 6000 }); Sound.play('bad'); break;
        case 'rivalBust': toast({ icon: '💀', title: `${p.name} collapsed`, desc: p.lost ? `Your ${fmt(p.lost)} of shares are worthless.` : 'One less rival on the board.', kind: p.lost ? 'bad' : 'good', ttl: 8000 }); break;
        case 'closeCall': toast({ icon: '😅', title: 'Close call!', desc: `Investors reward the nerve: +${fmt(p.bonus)}.`, kind: 'gold', ttl: 7000 }); Sound.play('achievement'); Confetti.burst(80, { power: 7 }); break;
        case 'streakBroken': toast({ icon: I('flame', 20), title: `${p.streak}-day profit streak broken`, desc: 'Investors are spooked. Sentiment dips.', kind: 'bad', ttl: 5000 }); break;
        case 'staffQuit': toast({ icon: I('user-minus', 20), title: `${p.n} staff quit ${p.biz.name}`, desc: 'Pay above market or people walk. Hire replacements and expect five days of training.', kind: 'bad', ttl: 6000 }); break;
        case 'raidSurvived': toast({ icon: I('shield', 20), title: `You survived ${p.rival}'s raid`, kind: 'good', ttl: 6000 }); Sound.play('achievement'); break;
      }
    },

    addFeed(item) {
      const list = $('#feedList'); if (!list) return;
      const el = document.createElement('div');
      el.className = 'feed-item ' + (item.kind || '');
      el.innerHTML = `${emo(item.icon)}<div><div>${esc(item.text)}</div><div class="day">Day ${G.S.day}</div></div>`;
      list.insertBefore(el, list.firstChild);
      while (list.children.length > 60) list.removeChild(list.lastChild);
      const feed = $('.feed');
      if (feed && !document.body.classList.contains('feed-open') && getComputedStyle(feed).display === 'none' && !$('#btnFeed .dot')) { const d = document.createElement('span'); d.className = 'dot'; $('#btnFeed').appendChild(d); }
    },
    rebuildFeed() {
      const list = $('#feedList'); list.innerHTML = '';
      for (const item of [...G.S.eventLog].reverse().slice(-60)) {
        const el = document.createElement('div'); el.className = 'feed-item ' + (item.kind || ''); el.style.animation = 'none';
        el.innerHTML = `${emo(item.icon)}<div><div>${esc(item.text)}</div><div class="day">Day ${item.day}</div></div>`;
        list.insertBefore(el, list.firstChild);
      }
    },
    updateNavDots() { $$('.navbtn').forEach(b => { let dot = $('.dot', b); if (UI.navDots[b.dataset.view]) { if (!dot) { dot = document.createElement('span'); dot.className = 'dot'; b.appendChild(dot); } } else if (dot) dot.remove(); }); },
    updateSpeedButtons() {
      const sp = H.getSpeed();
      $$('#speedCtl button').forEach(b => { b.classList.toggle('active', +b.dataset.speed === sp && sp > 0); b.classList.toggle('paused-active', sp === 0 && +b.dataset.speed === 0); });
    },

    showView(name) {
      UI.view = name; UI.navDots[name] = false; UI.updateNavDots();
      if (root.innerWidth <= 760) document.body.classList.remove('feed-open');
      $$('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
      if (name !== 'businesses') UI.detailBiz = null;
      UI.render(true);
      $('#view').scrollTop = 0;
    },
    openBusiness(id) { UI.detailBiz = id; UI.showView('businesses'); },

    // ---------- render cycle ------------------------------------------------------
    frame(now) {
      Confetti.frame();
      if (!G.S) return;
      if (UI.debug && now - (UI.lastDiag || 0) > 500) { UI.lastDiag = now; UI.renderDiag(); }
      const inputFocused = document.activeElement && $('#view').contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (now - UI.lastRefresh > 200) { UI.render(false, inputFocused); UI.lastRefresh = now; }
      if ((G.S.day !== UI.chartDay || UI.lastChart === 0) && now - UI.lastChart > 120) { UI.drawCharts(); UI.lastChart = now; UI.chartDay = G.S.day; }
    },
    computeStructKey() {
      const S = G.S;
      return [UI.view, UI.detailBiz, UI.rivalsTab, UI.marketMine, S.businesses.map(b => b.id + ':' + b.staff + ':' + (b.manager ? 'm' : '') + Object.values(b.upgrades).join('')).join(','), S.loans.map(l => l.id + (S.day >= l.due ? 'a' : '')).join(','),
        S.events.active.map(e => e.id).join(','), Object.values(S.hq).join(''), UI.ledgerSort.key + UI.ledgerSort.dir, Object.keys(S.portfolio).join(','), S.competitors.filter(c => c.acquired || c.bust).length,
        Object.keys(S.unlocked).length, S.quests.map(q => q.tid + (q.done ? 'd' : '')).join(','), S.cash < 0, S.flags.won, Object.keys(S.achievements).length,
        S.offers.map(o => o.id).join(','), S.marginDays >= ECONOMY.marginCallDays, !!S.raid, S.subsidiaries.map(s => s.id + (s.integration > 0 ? 'i' : '')).join(','),
        S.competitors.map(c => (c.priceWar > 0 ? 'w' : '') + (c.slump > 0 ? 's' : '')).join(''), UI.attentionKey || ''].join('|');
    },
    render(force, inputFocused) {
      if (!G.S) return;
      const key = UI.computeStructKey();
      if (force || key !== UI.structKey) {
        if (inputFocused && !force) { UI.refreshTop(); return; }
        UI.structKey = key; UI.mount();
      }
      UI.refresh();
    },
    mount() {
      const v = $('#view');
      switch (UI.view) {
        case 'dashboard': v.innerHTML = UI.htmlDashboard(); break;
        case 'businesses': v.innerHTML = UI.detailBiz && G.biz(UI.detailBiz) ? UI.htmlBizDetail(G.biz(UI.detailBiz)) : UI.htmlBusinesses(); break;
        case 'ledger': v.innerHTML = UI.htmlLedger(); break;
        case 'market': v.innerHTML = UI.htmlMarket(); break;
        case 'bank': v.innerHTML = UI.htmlBank(); break;
        case 'hq': v.innerHTML = UI.htmlHQ(); break;
        case 'rivals': v.innerHTML = UI.htmlRivals(); break;
      }
      UI.mountedView = UI.view;
      UI.hydrateIcons(v);
      UI.renderQuests();
      UI.lastChart = 0; UI.sparkDay = -1;
    },
    refresh() {
      UI.refreshTop();
      switch (UI.view) {
        case 'dashboard': UI.refreshDashboard(); break;
        case 'businesses': UI.detailBiz ? UI.refreshBizDetail() : UI.refreshBusinesses(); break;
        case 'ledger': UI.refreshLedger(); break;
        case 'market': UI.refreshMarket(); break;
        case 'bank': UI.refreshBank(); break;
        case 'hq': UI.refreshHQ(); break;
        case 'rivals': UI.refreshRivals(); break;
      }
      UI.renderQuests();
    },
    refreshTop() {
      const S = G.S;
      setText('#topCompany', S.company);
      const dayEl = $('#topDay');
      if (dayEl.textContent !== 'Day ' + S.day) { dayEl.textContent = 'Day ' + S.day; dayEl.classList.remove('ticking'); void dayEl.offsetWidth; dayEl.classList.add('ticking'); }
      setText('#topDate', dateLabel(Math.max(1, S.day)));
      const season = G.season();
      setText('#topSeason', `${season.icon} ${season.name}`);
      tweenNumber($('#topCashValue'), S.cash, fmt); $('#topCash').classList.toggle('neg', S.cash < 0);
      const rw = G.runway();
      const rwEl = $('#topRunway');
      setText('#topRunwayValue', rw === Infinity ? 'runway ∞' : `runway ${rw >= 100 ? '99+' : rw.toFixed(1)}d`);
      rwEl.className = 'runway ' + (S.cash < 0 ? 'crit' : rw < 3 ? 'crit' : rw < 8 ? 'warn' : '');
      const st = $('#topStreak');
      st.classList.toggle('hidden', S.streak < 3);
      setText('#topStreakValue', `${S.streak}d · ×${(S.streakBonus || 1).toFixed(2)}`);
      setText('#sideRank', `#${S.rank}`);
      UI.updateSpeedButtons();
    },

    // ============================================================================
    // DASHBOARD
    // ============================================================================
    // Everything the player needs to decide what to do next lives on this screen:
    // the goal, what is wrong right now, offers that are about to expire, then numbers.
    attention() {
      const S = G.S, items = [];
      const add = (icon, text, action, view, id, kind = 'bad') => items.push({ icon, text, action, view, id, kind });
      if (S.cash < 0) add(I('alert', 18), `Overdraft — ${10 - S.overdraftDays} days to get cash above zero.`, 'Go to Bank', 'bank', null);
      if (S.marginDays >= ECONOMY.marginCallDays) add(I('bank', 18), 'Debt exceeds your credit line. The bank is charging a penalty rate.', 'Repay', 'bank', null);
      else if (S.marginDays > 0) add(I('bank', 18), `Debt exceeds your credit line — ${ECONOMY.marginCallDays - S.marginDays} days until a margin call.`, 'Repay', 'bank', null);
      const rw = G.runway();
      if (S.cash > 0 && rw < 4) add(I('clock', 18), `Only ${runwayLabel(rw)} of cash for fixed costs.`, 'Bank', 'bank', null, 'warn');
      for (const l of S.loans) { const left = l.due - S.day; if (left >= 0 && left <= 10) add(I('bank', 18), `${fmt(l.amount)} loan term ends in ${left} days.`, 'Refinance', 'bank', null, 'warn'); }
      if (G.daysToLevy() <= 30 && S.day > 30) { const due = G.levyDue(); add('🧾', `Year-end levy of about ${fmt(due)} due in ${G.daysToLevy()} days${S.cash < due ? ' — you do not have the cash yet' : ''}.`, 'Bank', 'bank', null, S.cash < due ? 'bad' : 'warn'); }
      const warTypes = {};
      for (const b of S.businesses) {
        const rec = G.recommendedStaff(b), T = BUSINESS_TYPES[b.type];
        let minDays = Infinity;
        for (const pid of T.products) { const e = Math.max(b.last.expected[pid] || 0, 0.01); minDays = Math.min(minDays, b.stock[pid] / e); }
        if (minDays < 1 && !b.autoRestock) add(T.icon, `${b.name} is running out of stock.`, 'Restock', 'biz', b.id);
        if (b.staff < rec) add(T.icon, `${b.name} is understaffed (${b.staff} of ${rec}).`, 'Hire', 'biz', b.id, 'warn');
        const war = G.priceWarIn(b.type);
        if (war && T.products.some(pid => b.prices[pid] / G.fairPrice(pid) > ECONOMY.priceWarMatch)) { const w = warTypes[b.type] || (warTypes[b.type] = { war, n: 0 }); w.n++; }
        if (b.history.length > 10 && G.bizProfitEstimate(b) < 0 && b.rep < 40) add(T.icon, `${b.name} is losing money with poor reputation.`, 'Inspect', 'biz', b.id, 'warn');
      }
      for (const type in warTypes) { const w = warTypes[type]; add('⚔️', `${w.war.def.name} is in a price war with your ${BUSINESS_TYPES[type].name}s (${w.war.c.priceWar}d left). ${w.n} store${w.n > 1 ? 's are' : ' is'} priced above fair and losing customers.`, `Match prices`, 'matchWar', type); }
      for (const sub of S.subsidiaries) if (sub.integration === 0 && sub.health < 0.5) add(sub.icon, `${sub.name} has decayed to ${Math.round(sub.health * 100)}% strength.`, 'Reinvest', 'hq', null, 'warn');
      return items.slice(0, 6);
    },
    htmlDashboard() {
      const S = G.S;
      const stats = [['cash', 'Cash', 'accent-teal'], ['profit', 'Profit / day', 'accent-green'], ['revenue', 'Revenue / day', ''], ['debt', 'Debt', 'accent-red']];
      const nextType = TYPE_ORDER.find(t => !S.unlocked[t]);
      return `
        <div class="hero card">
          <div class="hero-main">
            <div class="hero-label">${S.challenge ? `${DAILY.name} · ends day ${DAILY.days}` : 'Company value'}${S.prestige ? ` · IPO #${S.prestige} legacy` : ''}</div>
            <div class="hero-value gold" id="heroValue">—</div>
            <div class="hero-sub" id="heroSub"></div>
            <div class="goal"><div class="goal-top"><span><b>${S.challenge ? 'Day' : 'Goal'}</b> · ${S.challenge ? `${DAILY.days} days` : fmt(S.winValue)}</span><span id="goalPct">0%</span></div><div class="goal-bar"><div class="fill" id="goalFill"></div></div></div>
          </div>
          <div class="hero-side">
            <div class="hero-kv"><span>Rank</span><b id="heroRank"></b></div>
            <div class="hero-kv"><span>Runway</span><b id="heroRunway"></b></div>
            <div class="hero-kv"><span>Sentiment</span><b id="heroSent"></b></div>
            <div class="hero-kv"><span>Next unlock</span><b>${nextType ? `${BUSINESS_TYPES[nextType].icon} ${fmt(BUSINESS_TYPES[nextType].unlock)}` : 'All unlocked'}</b></div>
            <div class="hero-kv"><span>Season</span><b>${G.season().icon} ${G.season().name}</b></div>
            <div class="hero-kv"><span>Levy in</span><b id="heroLevy"></b></div>
          </div>
        </div>
        <div class="grid cols-2 section">
          <div class="card attention"><h3>${I('target', 14)}Needs attention</h3><div id="attentionList"></div></div>
          <div class="card offers"><h3>${I('clock', 14)}Timed offers</h3><div id="offerList"></div></div>
        </div>
        <div class="grid stats section">
          ${stats.map(([k, label, cls]) => `<div class="card stat-card ${cls}" id="stat-${k}"><div class="label"><span>${label}</span><span class="delta" data-d="${k}"></span></div><div class="value" data-v="${k}">—</div><div class="delta small muted" data-s="${k}"></div><canvas data-spark="${k}"></canvas></div>`).join('')}
        </div>
        <div class="grid cols-2 section">
          <div class="card">
            <div class="row between"><h3>Company valuation</h3><div class="tabs" style="margin:0">${[30, 90, 365].map(r => `<button class="${UI.chartRange === r ? 'active' : ''}" data-action="range" data-range="${r}">${r}d</button>`).join('')}<button class="${UI.chartLog ? 'active' : ''}" data-action="logscale">log</button></div></div>
            <div class="chart-wrap"><canvas id="chartVal" data-hover="1" height="220"></canvas></div>
            <div class="small muted" style="margin-top:6px" id="valBreak"></div>
          </div>
          <div class="card">
            <div class="row between"><h3>Revenue vs profit (30 days)</h3><div class="legend"><span><i style="background:#5b9cff"></i>Revenue</span><span><i style="background:#2ee0b8"></i>Profit</span></div></div>
            <div class="chart-wrap"><canvas id="chartPL" height="220"></canvas></div>
          </div>
        </div>
        <div class="grid cols-3 section">
          <div class="card"><h3>Yesterday's P&amp;L</h3><div id="plBox"></div></div>
          <div class="card"><h3>Market conditions</h3><div id="eventsBox"></div></div>
          <div class="card"><h3>Empire</h3><div id="empireBox"></div></div>
        </div>
        <div class="tip-box section" id="tipBox">${I('lightbulb', 19)}<span id="tipText"></span></div>`;
    },
    refreshDashboard() {
      const S = G.S, h = S.history;
      const prev = (arr, k = 2) => arr.length >= k ? arr[arr.length - k] : null;
      // hero
      tweenNumber($('#heroValue'), S.valuation, fmt);
      const p = S.challenge ? clamp(S.day / DAILY.days, 0, 1) : clamp(S.valuation / S.winValue, 0, 1);
      $('#goalFill').style.width = Math.max(0.5, p * 100) + '%';
      setText('#goalPct', S.challenge ? `Day ${S.day} of ${DAILY.days}` : `${p < 0.001 ? (p * 100).toFixed(3) : (p * 100).toFixed(1)}%`);
      setHtml('#heroSub', `${deltaHtml(S.valuation, prev(h.valuation, 8))} <span class="muted">7 days</span> · ${fmt(S.sharePrice)}/share · net assets ${fmt(S.netAssets)} + goodwill ${fmt(S.goodwill)}`);
      setText('#heroRank', `#${S.rank} of ${G.ranking().length}`);
      const rw = G.runway(); const rwEl = $('#heroRunway'); rwEl.textContent = S.cash < 0 ? 'overdraft' : runwayLabel(rw); rwEl.className = S.cash < 0 || rw < 3 ? 'bad' : rw < 8 ? 'gold' : 'good';
      const sEl = $('#heroSent'); sEl.textContent = sentimentLabel(S.sentiment); sEl.className = S.sentiment >= 1.05 ? 'good' : S.sentiment <= 0.95 ? 'bad' : '';
      setText('#heroLevy', `${G.daysToLevy()}d · ${fmt(G.levyDue())}`);
      // attention + offers (structural, so re-render only on change)
      const items = UI.attention();
      const aKey = items.map(i => i.text).join('|') + '#' + S.offers.map(o => o.id + ':' + (o.expires - S.day)).join(',');
      if (UI.attentionKeyRendered !== aKey) {
        UI.attentionKeyRendered = aKey;
        setHtml('#attentionList', items.length ? items.map(i => `<div class="att ${i.kind}"><span class="ico">${isSvg(i.icon) ? i.icon : emo(i.icon)}</span><span class="txt">${esc(i.text)}</span><button class="btn xs ${i.kind === 'bad' ? 'danger' : ''}" data-action="att" data-view="${i.view}" data-id="${i.id || ''}">${esc(i.action)}</button></div>`).join('')
          : `<div class="att ok"><span class="ico">${I('circle-check', 18)}</span><span class="txt">All clear. Shelves full, staff paid, bank happy. Time to expand.</span><button class="btn xs primary" data-action="view" data-view="businesses">Expand</button></div>`);
        setHtml('#offerList', S.offers.length ? S.offers.map(o => { const left = o.expires - S.day; return `<div class="offer"><div class="offer-head"><span class="emo">${o.icon}</span><b>${esc(o.title)}</b><span class="badge ${left <= 1 ? 'bad' : 'gold'}">${I('clock', 11)}${left}d left</span></div><div class="small muted">${esc(o.desc)}</div><div class="row" style="margin-top:8px"><button class="btn xs primary" data-action="acceptOffer" data-id="${o.id}" ${S.cash < o.fee ? 'disabled' : ''}>Accept · ${fmt(o.fee)}</button><button class="btn xs ghost" data-action="declineOffer" data-id="${o.id}">Pass</button></div></div>`; }).join('')
          : '<div class="muted small">No offers on the table. They appear at random, do not pause the game, and vanish when the clock runs out.</div>');
        UI.hydrateIcons($('#attentionList'));
      }
      // stats
      const vals = { cash: S.cash, revenue: S.lastDay.revenue, profit: S.lastDay.profit, debt: G.totalDebt() };
      const series = { cash: h.cash, revenue: h.revenue, profit: h.profit, debt: h.debt };
      const prevs = { cash: prev(h.cash), revenue: prev(h.revenue), profit: prev(h.profit), debt: prev(h.debt) };
      for (const k in vals) {
        const el = $(`[data-v="${k}"]`); if (!el) continue;
        tweenNumber(el, vals[k], fmt);
        const d = $(`[data-d="${k}"]`); if (d) d.innerHTML = deltaHtml(vals[k], prevs[k], k === 'debt');
        const s = $(`[data-s="${k}"]`);
        if (s) s.textContent = k === 'profit' ? `30-day avg ${fmt(S.ema30)}/day · tax ${pct(G.taxRate(), 0)}` : k === 'debt' ? `${S.loans.length} loan${S.loans.length === 1 ? '' : 's'} · ${(G.currentRate() * 100).toFixed(2)}%/day · credit left ${fmt(G.availableCredit())}` : k === 'cash' ? (S.cash < 0 ? `⚠️ overdraft day ${S.overdraftDays}` : `inventory ${fmt(G.totalInventoryValue())} · ${S.businesses.length} location${S.businesses.length === 1 ? '' : 's'}`) : `${S.lastDay.units.toLocaleString()} units sold`;
        const canvas = $(`[data-spark="${k}"]`);
        if (canvas && series[k] && series[k].length > 1 && canvas._day !== S.day) { canvas._day = S.day; Charts.spark(canvas, series[k].slice(-40), k === 'debt' ? '#ff6b74' : k === 'profit' ? '#2ee0b8' : '#5b9cff'); }
      }
      setText('#valBreak', `Goodwill = 30-day avg profit × ${S.multiple.toFixed(0)} (sentiment ${sentimentLabel(S.sentiment).toLowerCase()}, streak ×${(S.streakBonus || 1).toFixed(2)})`);
      // P&L
      const L = S.lastDay;
      const rows = [['Revenue', L.revenue, 'good'], ['Cost of goods', -L.cogs], ['Spoilage', -(L.spoilage || 0)], ['Wages', -L.wages], ['Rent', -L.rent], ['Marketing', -L.marketing],
        ['Corporate overhead', -(L.overhead || 0)], ['Upgrade upkeep', -((L.upkeep || 0) + (L.hqUpkeep || 0))], ['Interest', -L.interest], ['Subsidiaries', L.subsidiaries || 0, (L.subsidiaries || 0) >= 0 ? 'good' : 'bad']]
        .filter(r => r[1] !== 0 || r[0] === 'Revenue');
      setHtml('#plBox', rows.map(r => `<div class="pl-row"><span>${r[0]}</span><span class="mono ${r[1] < 0 ? 'muted' : r[2] || ''}">${fmt(r[1])}</span></div>`).join('')
        + `<div class="pl-row"><span>Profit before tax</span><span class="mono ${L.pretax >= 0 ? '' : 'bad'}">${fmt(L.pretax || 0)}</span></div>`
        + `<div class="pl-row"><span>Corporate tax <span class="badge bad">${pct(G.taxRate(), 0)}</span></span><span class="mono muted">${fmt(-(L.tax || 0))}</span></div>`
        + `<div class="pl-row total"><span>Net profit</span><span class="mono ${L.profit >= 0 ? 'good' : 'bad'}">${fmt(L.profit)}</span></div>`
        + (L.repaid ? `<div class="pl-row"><span class="muted">Loan principal repaid</span><span class="mono muted">${fmt(-L.repaid)}</span></div>` : '')
        + (L.other ? `<div class="pl-row"><span class="muted">One-off cash (events, rewards, levy)</span><span class="mono ${L.other >= 0 ? 'gold' : 'bad'}">${sign(L.other)}${fmt(L.other)}</span></div>` : ''));
      // conditions
      const ev = S.events.active;
      const wars = S.competitors.map((c, i) => c.priceWar > 0 ? `<div class="chip bad" style="margin:0 6px 6px 0">⚔️ ${COMPETITORS[i].name} price war · ${BUSINESS_TYPES[c.priceWarType].name}s <span class="days">${c.priceWar}d</span></div>` : '').join('');
      const raid = S.raid ? `<div class="chip bad" style="margin:0 6px 6px 0">🦈 ${esc(S.raid.rival)} raid <span class="days">${S.raid.days}d</span></div>` : '';
      setHtml('#eventsBox', (ev.length || wars || raid ? ev.map(e => `<div class="chip ${e.kind === 'bad' ? 'bad' : e.kind === 'good' ? 'good' : ''}" style="margin:0 6px 6px 0">${e.icon} ${esc(e.title)} <span class="days">${e.days}d</span></div>`).join('') + wars + raid : '<div class="muted small">Calm markets. Enjoy it while it lasts.</div>') +
        `<div class="divider"></div><div class="kv"><span>${G.season().icon} ${G.season().name}</span><span class="v small muted">${G.season().blurb}</span></div><div class="kv"><span>Interest rate</span><span class="v">${(G.currentRate() * 100).toFixed(2)}%/day</span></div><div class="kv"><span>Wage index</span><span class="v">×${G.wageIndex().toFixed(2)}</span></div>`);
      // empire
      setHtml('#empireBox', `<div class="kv"><span>Businesses</span><span class="v">${S.businesses.length}</span></div><div class="kv"><span>Employees</span><span class="v">${G.totalStaff()}</span></div><div class="kv"><span>Subsidiaries</span><span class="v">${S.subsidiaries.length}</span></div><div class="kv"><span>Stock portfolio</span><span class="v">${fmt(G.portfolioValue())}</span></div><div class="kv"><span>Overhead</span><span class="v">${pct(G.overheadRate(), 0)} of rent</span></div><div class="kv"><span>Daily upkeep</span><span class="v">${fmt(G.hqUpkeep() + S.businesses.reduce((a, b) => a + G.bizUpkeep(b), 0))}</span></div><div class="kv"><span>Achievements</span><span class="v">${Object.keys(S.achievements).length}/${ACHIEVEMENTS.length}</span></div>
        <div class="row" style="margin-top:12px"><button class="btn sm primary" data-action="view" data-view="businesses">${I('store', 16)}Businesses</button><button class="btn sm" data-action="restockAll">${I('boxes', 16)}Restock all</button><button class="btn sm" data-action="pricesAll">${I('tag', 16)}Suggested prices</button></div>`);
      UI.refreshTip();
    },
    refreshTip() {
      const S = G.S, el = $('#tipText'); if (!el) return;
      let tip;
      const b0 = S.businesses[0];
      if (S.day < 3 && b0) tip = `Welcome, ${esc(S.company)}! Your Corner Store has 2 days of stock. Open <b>Businesses → ${esc(b0.name)}</b> to restock, set prices and hire.`;
      else if (S.businesses.some(b => Object.values(b.stock).every(v => v === 0)) && S.day < 20) tip = 'A store has empty shelves! Restock it or switch on <b>auto-restock</b> so it never runs dry.';
      else if (S.day < 12 && S.stats.loansTaken === 0) tip = 'Growth needs capital. The <b>Bank</b> lends for 90 days at a time — borrow only when the return beats the interest and you can repay.';
      else if (S.day > 25 && S.businesses.length > 2 && S.stats.upgradesBought === 0) tip = 'Upgrades come in branches, and each level costs daily <b>upkeep</b>. Open a business and start with <b>Capacity</b> or <b>Operations</b>.';
      else if (S.businesses.length === 1 && S.day > 15) tip = 'Expand! Open a second business from <b>Businesses</b>. Watch for <b>distressed sales</b> on the dashboard — half price.';
      else {
        if (S.day - UI.lastTipDay >= 15) { UI.lastTipDay = S.day; UI.tipIndex = (UI.tipIndex + 1) % TIPS.length; }
        tip = esc(TIPS[UI.tipIndex]);
      }
      if (el.innerHTML !== tip) el.innerHTML = tip;
    },
    drawCharts() {
      const S = G.S;
      if (UI.view === 'dashboard') {
        const cv = $('#chartVal'), cp = $('#chartPL');
        if (cv) { const data = S.history.valuation.slice(-UI.chartRange); Charts.line(cv, data, { color: '#5b9cff', log: UI.chartLog, startDay: S.day - data.length + 1, height: 220 }); }
        if (cp) { const r = S.history.revenue.slice(-30), p = S.history.profit.slice(-30); Charts.bars(cp, r, p, { startDay: S.day - r.length + 1, height: 220 }); }
      } else if (UI.view === 'market') {
        $$('canvas[data-mspark]').forEach(c => { const m = S.market[c.dataset.mspark]; if (m) Charts.spark(c, m.history.slice(-30), '#5b9cff', 28); });
      } else if (UI.view === 'rivals') {
        $$('canvas[data-rspark]').forEach(c => { const hist = c.dataset.rspark === 'you' ? S.history.valuation : (G._comp(c.dataset.rspark) || {}).history; if (hist) Charts.spark(c, hist.slice(-30), c.dataset.rspark === 'you' ? '#ffc043' : '#9d8cff', 28); });
      } else if (UI.view === 'businesses' && UI.detailBiz) {
        const c = $('#bizChart'); const b = G.biz(UI.detailBiz);
        if (c && b) Charts.bars(c, b.history.slice(-30), null, { colorA: '#2ee0b8', height: 140, startDay: S.day - Math.min(30, b.history.length) + 1 });
      }
    },

    // ============================================================================
    // BUSINESSES (list + expansion shop)
    // ============================================================================
    htmlBusinesses() {
      const S = G.S;
      return `<div class="view-title"><div><h1>Businesses</h1><div class="sub">${S.businesses.length} location${S.businesses.length === 1 ? '' : 's'} · ${G.totalStaff()} employees</div></div>
        <div class="row"><button class="btn sm" data-action="autoAll">${I('bolt', 16)}Auto-restock all</button><button class="btn sm" data-action="restockAll">${I('boxes', 16)}Restock all · ${UI.restockDays}d</button><button class="btn sm" data-action="pricesAll">${I('tag', 16)}Suggested prices</button></div></div>
        <div class="grid auto" id="bizGrid">${S.businesses.map(b => UI.htmlBizCard(b)).join('') || '<div class="card empty">You own no businesses. Buy one below before the bank comes knocking.</div>'}</div>
        <div class="section"><div class="view-title"><div><h1 style="font-size:18px">Expand your empire</h1><div class="sub">New types unlock as your company value grows. Extra copies of a type cost more and share customers.</div></div></div>
        <div class="grid auto" id="shopGrid">${TYPE_ORDER.map(t => UI.htmlShopCard(t)).join('')}</div></div>`;
    },
    htmlBizCard(b) {
      const T = BUSINESS_TYPES[b.type];
      return `<div class="card biz-card" data-action="openBiz" data-id="${b.id}" id="bizcard-${b.id}">
        <div class="head"><div class="ico">${T.icon}</div><div><div class="name">${esc(b.name)}${b.manager ? ' <span class="badge gold" title="Star manager">🌟</span>' : ''}</div><div class="type">${b.name === T.name ? `Tier ${T.tier} · ${D.CATEGORIES[PRODUCTS[T.products[0]].cat]}` : T.name}</div></div></div>
        <div class="warn" data-warn></div>
        <div class="stats">
          <div>Profit/day <b data-f="profit"></b></div><div>Staff <b data-f="staff"></b></div>
          <div>Stock <b data-f="stock"></b></div><div>Service <b data-f="service"></b></div>
        </div>
        <div class="row between small" style="margin-top:10px"><span class="muted">Reputation</span><b data-f="rep"></b></div>
        <div class="bar" style="margin-top:4px"><div class="fill" data-f="repbar"></div></div>
      </div>`;
    },
    htmlShopCard(t) {
      const S = G.S, T = BUSINESS_TYPES[t];
      const unlocked = !!S.unlocked[t];
      const owned = S.businesses.filter(b => b.type === t).length;
      return `<div class="card shop-card ${unlocked ? '' : 'locked'}" id="shop-${t}">
        <div class="head"><div class="ico">${T.icon}</div><div><b>${T.name}</b> <span class="badge">Tier ${T.tier}</span>${owned ? ` <span class="badge teal">×${owned}</span>` : ''}<div class="muted small">${T.blurb}</div></div></div>
        <div class="small muted">Sells: ${T.products.map(p => PRODUCTS[p].icon + ' ' + PRODUCTS[p].name).join(', ')}</div>
        <div class="small muted">Base traffic ${T.traffic} · rent ${fmt(T.rent)}/day · wage ${fmt(T.wage)}/day</div>
        <div class="row between" style="margin-top:4px"><span class="price" data-f="cost"></span>
          ${unlocked ? `<button class="btn sm primary" data-action="buyBiz" data-type="${t}" data-f="buybtn">Open</button>` : `<span class="badge">${I('lock', 12)}Needs ${fmt(T.unlock)}</span>`}</div>
      </div>`;
    },
    refreshBusinesses() {
      const S = G.S;
      for (const b of S.businesses) {
        const card = $(`#bizcard-${b.id}`); if (!card) continue;
        const T = BUSINESS_TYPES[b.type];
        const profit = G.bizProfitEstimate(b);
        const rec = G.recommendedStaff(b);
        let minDays = Infinity;
        for (const pid of T.products) { const e = Math.max(b.last.expected[pid] || 0, 0.01); minDays = Math.min(minDays, b.stock[pid] / e); }
        const p = $('[data-f="profit"]', card); p.textContent = fmt(profit); p.className = profit >= 0 ? 'good' : 'bad';
        const st = $('[data-f="staff"]', card); const tr = G.traineeCount(b); st.textContent = `${b.staff} / ${rec}${tr ? ` (${tr} training)` : ''}`; st.className = b.staff < rec ? 'bad' : '';
        const sk = $('[data-f="stock"]', card); sk.textContent = minDays === Infinity ? '—' : `${minDays.toFixed(1)} days`; sk.className = minDays < 1 ? 'bad' : minDays < 2 ? 'gold' : '';
        const sv = $('[data-f="service"]', card); sv.textContent = pct(b.last.serviceRatio, 0); sv.className = b.last.serviceRatio < 0.85 ? 'bad' : '';
        $('[data-f="rep"]', card).textContent = Math.round(b.rep);
        const rb = $('[data-f="repbar"]', card); rb.style.width = b.rep + '%'; rb.className = 'fill ' + (b.rep >= 70 ? 'green' : b.rep >= 40 ? 'gold' : 'red');
        const warns = [];
        if (b.staff < rec) warns.push('<span class="badge bad">Understaffed</span>');
        if (minDays < 1) warns.push('<span class="badge bad">Low stock</span>');
        if (b.history.length > 5 && profit < 0) warns.push('<span class="badge bad">Losing money</span>');
        if (G.priceWarIn(b.type)) warns.push('<span class="badge bad">⚔️ Price war</span>');
        if (b.autoRestock) warns.push('<span class="badge teal">Auto</span>');
        setHtml('[data-warn]', warns.join(' '), card);
      }
      for (const t of TYPE_ORDER) {
        const card = $(`#shop-${t}`); if (!card) continue;
        const cost = G.bizCost(t);
        setText('[data-f="cost"]', fmt(cost), card);
        const btn = $('[data-f="buybtn"]', card);
        if (btn) { btn.disabled = S.cash < cost; btn.classList.toggle('glow', S.cash >= cost); btn.textContent = S.cash >= cost ? 'Open now' : `Need ${fmt(cost - S.cash)} more`; }
      }
    },

    // ============================================================================
    // BUSINESS DETAIL
    // ============================================================================
    htmlBizDetail(b) {
      const S = G.S, T = BUSINESS_TYPES[b.type];
      return `<div class="view-title"><div class="row"><button class="btn sm ghost" data-action="backBiz">${I('arrow-left', 16)}All businesses</button><h1><span class="emo">${T.icon}</span><span id="bizName">${esc(b.name)}</span></h1><button class="btn xs ghost icon-only" data-action="rename" data-id="${b.id}" title="Rename">${I('pencil', 15)}</button>${b.manager ? '<span class="badge gold">🌟 Star manager</span>' : ''}</div>
        <div class="row"><span class="badge">${T.name}</span><button class="btn sm danger" data-action="sellBiz" data-id="${b.id}">${I('tag', 15)}Sell for <span data-f="salevalue"></span></button></div></div>
        <div class="grid cols-3">
          <div class="card"><h3>Reputation</h3><div class="row"><span class="big-num" data-f="rep"></span><span class="muted small" data-f="repnote"></span></div><div class="bar" style="margin-top:6px"><div class="fill" data-f="repbar"></div></div><div class="small muted" style="margin-top:6px">Multiplies traffic ×<span data-f="repmult"></span>. It drifts back to 50 unless you earn it: full shelves, enough staff, prices no more than ${Math.round((ECONOMY.repGougeAt - 1) * 100)}% over fair.</div></div>
          <div class="card"><h3>Yesterday</h3>
            <div class="pl-row"><span>Revenue</span><span class="mono good" data-f="rev"></span></div>
            <div class="pl-row"><span>Cost of goods</span><span class="mono muted" data-f="cogs"></span></div>
            <div class="pl-row"><span>Wages</span><span class="mono muted" data-f="wages"></span></div>
            <div class="pl-row"><span>Rent + marketing</span><span class="mono muted" data-f="rentmk"></span></div>
            <div class="pl-row"><span>Overhead + upkeep</span><span class="mono muted" data-f="ohup"></span></div>
            <div class="pl-row"><span>Tax share</span><span class="mono muted" data-f="btax"></span></div>
            <div class="pl-row total"><span>Net</span><span class="mono" data-f="profit"></span></div></div>
          <div class="card"><h3>Profit (30 days)</h3><div class="chart-wrap"><canvas id="bizChart" height="140"></canvas></div></div>
        </div>
        <div class="card section">
          <div class="row between"><h3>Products &amp; pricing</h3><div class="row"><span class="small muted">Buy for:</span><div class="btngroup">${[1, 3, 7].map(d => `<button class="btn xs ${UI.restockDays === d ? 'primary' : ''}" data-action="setRestockDays" data-days="${d}">${d} day${d > 1 ? 's' : ''}</button>`).join('')}</div><button class="btn sm" data-action="buyAllBiz" data-id="${b.id}">${I('boxes', 16)}Restock all</button><button class="btn sm" data-action="pricesBiz" data-id="${b.id}">${I('tag', 16)}Suggested prices</button></div></div>
          <div class="grid products">${T.products.map(pid => UI.htmlProductCard(b, pid)).join('')}</div>
        </div>
        <div class="grid cols-2 section">
          <div class="card"><h3>Staff &amp; wages</h3>
            <div class="staff-box">
              <div><div class="muted small">Employees</div><div class="row"><span class="big-num" data-f="staff"></span><span class="muted small">recommended <b data-f="recstaff"></b></span></div>
                <div class="small muted" data-f="trainees"></div>
                <div class="btngroup" style="margin-top:8px"><button class="btn sm" data-action="fire" data-id="${b.id}" data-n="5">−5</button><button class="btn sm" data-action="fire" data-id="${b.id}" data-n="1">−1</button><button class="btn sm primary" data-action="hire" data-id="${b.id}" data-n="1">+1</button><button class="btn sm primary" data-action="hire" data-id="${b.id}" data-n="5">+5</button><button class="btn sm gold" data-action="hireRec" data-id="${b.id}">${I('users', 15)}Auto-fit</button></div>
                <div class="small muted" style="margin-top:6px">Wage bill <b data-f="wagebill"></b>/day · new hires train for ${ECONOMY.traineeDays} days · firing costs 2 days' pay</div></div>
              <div><div class="muted small">Service level <span class="muted">(customers served)</span></div><div class="row"><span class="big-num" data-f="service"></span></div><div class="bar" style="margin-top:6px"><div class="fill" data-f="servicebar"></div></div>
                <div class="small muted" style="margin-top:8px">Capacity <b data-f="capacity"></b> units/day vs demand <b data-f="demandunits"></b></div></div>
            </div>
            <div class="divider"></div>
            <div class="row between"><span>Wage level: <b data-f="wagelbl"></b></span><span data-f="morale"></span></div>
            <input type="range" min="0.6" max="1.6" step="0.1" value="${b.wageMult}" data-input="wage" data-id="${b.id}">
            <div class="small muted">Higher pay = productive staff (×<b data-f="prod"></b>) who stay. At market wage about <b data-f="quit"></b> of staff quit each month.</div>
          </div>
          <div class="card"><h3>Marketing &amp; automation</h3>
            <div class="row between"><span>Marketing budget: <b data-f="mklbl"></b>/day</span><span class="good" data-f="mkboost"></span></div>
            <input type="range" min="0" max="${T.rent * 8}" step="${Math.max(1, Math.round(T.rent / 10))}" value="${b.marketing}" data-input="marketing" data-id="${b.id}">
            <div class="divider"></div>
            <div class="row between" style="margin-bottom:10px"><div><b>Auto-restock</b><div class="small muted">Keeps <input class="input sm" type="number" min="1" max="30" value="${b.stockDays}" data-input="stockDays" data-id="${b.id}" style="width:56px"> days of stock in every product</div></div><div class="toggle ${b.autoRestock ? 'on' : ''}" data-action="toggleAuto" data-id="${b.id}"></div></div>
            <div class="row between"><div><b>Smart pricing</b><div class="small muted">${S.hq.analytics ? 'Re-prices products daily to the suggested price.' : 'Requires the Analytics Suite (HQ).'}</div></div><div class="toggle ${b.autoPrice ? 'on' : ''} ${S.hq.analytics ? '' : 'disabled'}" data-action="toggleAutoPrice" data-id="${b.id}"></div></div>
          </div>
        </div>
        <div class="card section"><div class="row between"><h3>Upgrades</h3><span class="badge">${I('clock', 12)}Upkeep <b data-f="bizupkeep"></b>/day</span></div>
          <div class="grid cols-2">${Object.keys(UPGRADE_BRANCHES).map(br => UI.htmlBranch(b, br)).join('')}</div>
        </div>`;
    },
    htmlBranch(b, br) {
      const S = G.S, B = UPGRADE_BRANCHES[br];
      const ids = Object.keys(UPGRADES).filter(u => UPGRADES[u].branch === br).sort((x, y) => UPGRADES[x].tier - UPGRADES[y].tier);
      return `<div class="branch">
        <div class="branch-head"><span class="emo">${B.icon}</span><div><b>${B.name}</b><span class="muted small">${B.desc}</span></div></div>
        ${ids.map(uid => {
          const U = UPGRADES[uid], lvl = b.upgrades[uid] || 0, cost = G.upgradeCost(b, uid), lock = G.upgradeLock(b, uid);
          const upkeep = cost === null ? 0 : cost * U.upkeep;
          return `<div class="upgrade-row ${cost === null ? 'maxed' : ''} ${lock ? 'locked' : ''}">
            <div class="ico">${U.icon}</div>
            <div class="info"><b>${U.name} ${levelDots(lvl, U.max)}</b><span>${U.desc}</span>
              ${lock ? `<span class="lockline">${I('lock', 11)}${esc(lock)}</span>` : cost === null ? '' : `<span class="lockline muted">${I('clock', 11)}Adds ${fmt(upkeep)}/day upkeep</span>`}</div>
            ${cost === null ? '<span class="badge gold">MAX</span>'
              : lock ? `<span class="badge">${I('lock', 12)}Locked</span>`
              : `<button class="btn sm ${S.cash >= cost ? 'primary' : ''}" data-action="upgrade" data-id="${b.id}" data-uid="${uid}" data-f="upg-${uid}">${fmt(cost)}</button>`}
          </div>`;
        }).join('')}
      </div>`;
    },
    // One card per product: stock, wholesale, your price, demand, buy. Room to breathe.
    htmlProductCard(b, pid) {
      const p = PRODUCTS[pid];
      return `<div class="pcard" id="prow-${pid}">
        <div class="pcard-head"><span class="ico">${p.icon}</span><div><b>${p.name}</b><div class="small muted" data-f="sold"></div></div><span data-f="demand"></span></div>
        <div class="pcard-stock"><div class="row between small"><span class="muted">Stock</span><span><b class="mono" data-f="stock"></b> <span class="muted" data-f="cap"></span></span></div><div class="bar stockbar"><div class="fill" data-f="stockbar"></div></div><div class="row between small" style="margin-top:4px"><span data-f="days"></span><span class="muted" data-f="expect"></span></div></div>
        <div class="pcard-row">
          <div><div class="lbl">Wholesale</div><b class="mono" data-f="cost"></b> <span class="small muted" data-f="trend"></span></div>
          <div><div class="lbl">Your price</div><div class="price-ctl"><button class="btn xs" data-action="priceStep" data-id="${b.id}" data-pid="${pid}" data-dir="-1">−</button><input class="input sm" type="number" step="any" min="0.01" value="${b.prices[pid]}" data-input="price" data-id="${b.id}" data-pid="${pid}"><button class="btn xs" data-action="priceStep" data-id="${b.id}" data-pid="${pid}" data-dir="1">+</button></div><div class="small" data-f="pricenote"></div></div>
        </div>
        <div class="pcard-buy"><button class="btn sm primary" data-action="buy" data-id="${b.id}" data-pid="${pid}" data-f="buybtn">Buy</button><button class="btn sm" data-action="buyMax" data-id="${b.id}" data-pid="${pid}">Fill</button>${p.perishable ? '<span class="badge" title="Perishable">🧊</span>' : ''}</div>
      </div>`;
    },
    refreshBizDetail() {
      const S = G.S, b = G.biz(UI.detailBiz); if (!b) { UI.detailBiz = null; UI.render(true); return; }
      const T = BUSINESS_TYPES[b.type], fx = G.activeEffects(); G._fx = fx;
      setText('#bizName', b.name);
      setText('[data-f="salevalue"]', fmt(G.bizSaleValue(b)));
      setText('[data-f="rep"]', Math.round(b.rep));
      setText('[data-f="repnote"]', b.rep >= 85 ? 'Beloved' : b.rep >= 65 ? 'Well liked' : b.rep >= 45 ? 'Average' : b.rep >= 25 ? 'Poor' : 'Terrible');
      const rb = $('[data-f="repbar"]'); rb.style.width = b.rep + '%'; rb.className = 'fill ' + (b.rep >= 70 ? 'green' : b.rep >= 40 ? 'gold' : 'red');
      setText('[data-f="repmult"]', G.repFactor(b.rep).toFixed(2));
      const L = b.last;
      setText('[data-f="rev"]', fmt(L.revenue)); setText('[data-f="cogs"]', fmt(-(L.cogs + L.spoiled))); setText('[data-f="wages"]', fmt(-L.wages)); setText('[data-f="rentmk"]', fmt(-(L.rent + L.marketing)));
      setText('[data-f="ohup"]', fmt(-(L.overhead + L.upkeep))); setText('[data-f="btax"]', fmt(-L.tax));
      const pr = $('[data-f="profit"]'); pr.textContent = fmt(L.net); pr.className = 'mono ' + (L.net >= 0 ? 'good' : 'bad');
      const war = G.priceWarIn(b.type);
      let totalExp = 0;
      for (const pid of T.products) {
        const row = $(`#prow-${pid}`); if (!row) continue;
        const cap = G.capacity(b, pid), exp = G.expectedDemand(b, pid, b.prices[pid], fx); totalExp += exp;
        const days = b.stock[pid] / Math.max(exp, 0.01);
        setText('[data-f="stock"]', b.stock[pid].toLocaleString(), row); setText('[data-f="cap"]', `/ ${cap.toLocaleString()}`, row);
        const sb = $('[data-f="stockbar"]', row); sb.style.width = (b.stock[pid] / cap * 100) + '%'; sb.className = 'fill ' + (days < 1 ? 'red' : days < 2 ? 'gold' : 'green');
        const dEl = $('[data-f="days"]', row); dEl.textContent = b.stock[pid] === 0 ? 'OUT OF STOCK' : `≈ ${days.toFixed(1)} days left`; dEl.className = 'small ' + (b.stock[pid] === 0 ? 'bad' : days < 1 ? 'gold' : 'muted');
        setText('[data-f="sold"]', `sold ${L.sold[pid] || 0} yesterday`, row);
        const cost = G.buyCost(pid, b), m = S.market[pid], h = m.history, prev = h.length > 7 ? h[h.length - 8] : h[0];
        setText('[data-f="cost"]', fmt(cost), row);
        const ch = prev ? (m.cost - prev) / prev : 0;
        setHtml('[data-f="trend"]', `${ch > 0.02 ? '<span class="bad">▲</span>' : ch < -0.02 ? '<span class="good">▼</span>' : '→'} ${Math.abs(ch * 100).toFixed(0)}% / 7d`, row);
        const inp = $('[data-input="price"]', row); if (document.activeElement !== inp && +inp.value !== b.prices[pid]) inp.value = b.prices[pid];
        const ratio = b.prices[pid] / G.fairPrice(pid);
        const margin = b.prices[pid] - b.avgCost[pid];
        const warNote = war && ratio > ECONOMY.priceWarMatch ? ` <span class="bad">⚔️ losing ${Math.round((1 - ECONOMY.priceWarPenalty) * 100)}% to ${esc(war.def.name)}</span>` : '';
        setHtml('[data-f="pricenote"]', `${priceBadge(ratio)} <span class="muted">suggested ${fmt(G.suggestedPrice(pid))} · margin <span class="${margin >= 0 ? 'good' : 'bad'}">${fmt(margin)}</span></span>${warNote}`, row);
        setHtml('[data-f="demand"]', demandBadge(G.demandMult(b, pid, fx)), row);
        setText('[data-f="expect"]', `≈ ${exp < 10 ? exp.toFixed(1) : Math.round(exp)} / day`, row);
        const qty = Math.max(1, Math.ceil(exp * UI.restockDays));
        const btn = $('[data-f="buybtn"]', row); const q = Math.min(qty, cap - b.stock[pid]);
        btn.textContent = q <= 0 ? 'Full' : `Buy ${q} · ${fmt(q * cost)}`; btn.disabled = q <= 0 || S.cash < cost;
      }
      G._fx = null;
      const rec = G.recommendedStaff(b), capU = G.throughput(b, fx), tr = G.traineeCount(b);
      setText('[data-f="staff"]', b.staff); setText('[data-f="recstaff"]', rec);
      setText('[data-f="trainees"]', tr ? `${tr} in training (${Math.round(ECONOMY.traineeSpeed * 100)}% speed)` : 'Everyone is fully trained.');
      setText('[data-f="wagebill"]', fmt(b.staff * G.dailyWage(b, fx)));
      const sv = L.serviceRatio; const svEl = $('[data-f="service"]'); svEl.textContent = pct(sv, 0); svEl.className = 'big-num ' + (sv < 0.85 ? 'bad' : sv < 0.97 ? 'gold' : 'good');
      const svb = $('[data-f="servicebar"]'); svb.style.width = (sv * 100) + '%'; svb.className = 'fill ' + (sv < 0.85 ? 'red' : sv < 0.97 ? 'gold' : 'green');
      setText('[data-f="capacity"]', Math.round(capU).toLocaleString()); setText('[data-f="demandunits"]', Math.round(totalExp).toLocaleString());
      setText('[data-f="wagelbl"]', `${Math.round(b.wageMult * 100)}% of market (${fmt(G.dailyWage(b, fx))}/day)`);
      setHtml('[data-f="morale"]', moraleLabel(b.wageMult)); setText('[data-f="prod"]', G.productivity(b, fx).toFixed(2));
      setText('[data-f="quit"]', pct(Math.min(1, G.quitRate(b) * 30), 0));
      setText('[data-f="mklbl"]', fmt(b.marketing)); setText('[data-f="mkboost"]', `+${((G.marketingFactor(b) - 1) * 100).toFixed(0)}% traffic`);
      setText('[data-f="bizupkeep"]', fmt(G.bizUpkeep(b)));
      for (const uid in UPGRADES) { const btn = $(`[data-f="upg-${uid}"]`); if (btn) { const c = G.upgradeCost(b, uid); btn.disabled = c === null || S.cash < c; btn.classList.toggle('primary', c !== null && S.cash >= c); } }
    },

    // ============================================================================
    // LEDGER — per-business profit and loss
    // ============================================================================
    htmlLedger() {
      const S = G.S;
      const cols = [
        ['name', 'Business', false], ['revenue', 'Revenue', true], ['cogs', 'Goods', true], ['wages', 'Wages', true],
        ['fixed', 'Fixed', true], ['overhead', 'Admin', true], ['upkeep', 'Upkeep', true], ['tax', 'Tax', true],
        ['net', 'Net / day', true], ['margin', 'Margin', true], ['roi', 'ROI', true],
      ];
      return `<div class="view-title"><div><h1>Ledger</h1><div class="sub">Yesterday's profit and loss for every business. Overhead and tax are shared out by size, so the rows add up to the company total.</div></div>
        <div class="row"><span class="badge">${I('scale', 12)}Tax rate <b data-f="taxrate"></b></span><span class="badge">${I('building', 12)}Overhead <b data-f="ohrate"></b> of rent</span></div></div>
        <div class="card"><div class="table-wrap"><table class="table ledger"><thead><tr>
          ${cols.map(c => `<th class="${c[2] ? 'num' : ''} sortable" data-action="ledgerSort" data-key="${c[0]}">${c[1]}<span data-sort="${c[0]}"></span></th>`).join('')}
        </tr></thead><tbody id="ledgerBody"></tbody>
        <tfoot id="ledgerFoot"></tfoot></table></div>
        ${S.businesses.length ? '' : '<div class="empty">No businesses yet.</div>'}</div>
        <div class="grid cols-3 section">
          <div class="card"><h3>Company costs</h3><div id="ledgerCompany"></div></div>
          <div class="card"><h3>Where the money goes</h3><div id="ledgerSplit"></div></div>
          <div class="card"><h3>Best and worst</h3><div id="ledgerBest"></div></div>
        </div>`;
    },
    ledgerRows() {
      const S = G.S;
      return S.businesses.map(b => {
        const L = b.last, T = BUSINESS_TYPES[b.type];
        const gross = L.revenue - L.cogs - L.spoiled;
        const invested = b.paid + b.upgradesPaid;
        return {
          id: b.id, name: b.name, icon: T.icon, type: T.name,
          revenue: L.revenue, cogs: L.cogs + L.spoiled, gross, wages: L.wages, fixed: L.rent + L.marketing,
          overhead: L.overhead, upkeep: L.upkeep, tax: L.tax, net: L.net,
          margin: L.revenue > 0 ? L.net / L.revenue : 0,
          roi: invested > 0 ? (G.bizProfitEstimate(b) * 360) / invested : 0,
        };
      });
    },
    refreshLedger() {
      const S = G.S;
      setText('[data-f="taxrate"]', pct(G.taxRate(), 0));
      setText('[data-f="ohrate"]', pct(G.overheadRate(), 0));
      const sort = UI.ledgerSort;
      if (UI.ledgerDay === S.day && UI.ledgerKey === sort.key + sort.dir) return;
      UI.ledgerDay = S.day; UI.ledgerKey = sort.key + sort.dir;
      const rows = UI.ledgerRows();
      rows.sort((a, b) => sort.key === 'name' ? a.name.localeCompare(b.name) * -sort.dir : (a[sort.key] - b[sort.key]) * sort.dir);
      const money = v => fmt(v);
      const body = $('#ledgerBody');
      if (body) body.innerHTML = rows.map(r => `<tr data-action="openBiz" data-id="${r.id}" style="cursor:pointer">
        <td><div class="lname"><span class="emo">${r.icon}</span><span><b>${esc(r.name)}</b><span class="muted small">${r.type}</span></span></div></td>
        <td class="num">${money(r.revenue)}</td><td class="num muted">${money(-r.cogs)}</td>
        <td class="num muted">${money(-r.wages)}</td><td class="num muted">${money(-r.fixed)}</td>
        <td class="num muted">${money(-r.overhead)}</td><td class="num muted">${money(-r.upkeep)}</td><td class="num muted">${money(-r.tax)}</td>
        <td class="num ${r.net >= 0 ? 'good' : 'bad'}"><b>${money(r.net)}</b></td>
        <td class="num ${r.margin >= 0.15 ? 'good' : r.margin < 0 ? 'bad' : ''}">${pct(r.margin, 0)}</td>
        <td class="num ${r.roi >= 0.5 ? 'good' : r.roi < 0 ? 'bad' : ''}">${pct(r.roi, 0)}</td></tr>`).join('');
      const sum = k => rows.reduce((a, r) => a + r[k], 0);
      const foot = $('#ledgerFoot');
      if (foot) foot.innerHTML = `<tr><td><b>All businesses</b></td><td class="num">${money(sum('revenue'))}</td><td class="num muted">${money(-sum('cogs'))}</td>
        <td class="num muted">${money(-sum('wages'))}</td><td class="num muted">${money(-sum('fixed'))}</td>
        <td class="num muted">${money(-sum('overhead'))}</td><td class="num muted">${money(-sum('upkeep'))}</td><td class="num muted">${money(-sum('tax'))}</td>
        <td class="num ${sum('net') >= 0 ? 'good' : 'bad'}"><b>${money(sum('net'))}</b></td>
        <td class="num">${pct(sum('revenue') > 0 ? sum('net') / sum('revenue') : 0, 0)}</td><td></td></tr>`;
      $$('[data-sort]').forEach(el => { el.textContent = el.dataset.sort === sort.key ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''; });
      const L = S.lastDay;
      setHtml('#ledgerCompany', `<div class="kv"><span>Businesses (net)</span><span class="v ${sum('net') >= 0 ? 'good' : 'bad'}">${money(sum('net'))}</span></div>
        <div class="kv"><span>Head office upkeep</span><span class="v">${fmt(-L.hqUpkeep)}</span></div>
        <div class="kv"><span>Loan interest</span><span class="v">${fmt(-L.interest)}</span></div>
        <div class="kv"><span>Subsidiaries</span><span class="v ${(L.subsidiaries || 0) >= 0 ? 'good' : 'bad'}">${fmt(L.subsidiaries)}</span></div>
        <div class="kv"><span>Profit before tax</span><span class="v">${fmt(L.pretax)}</span></div>
        <div class="kv"><span>Corporate tax</span><span class="v bad">${fmt(-L.tax)}</span></div>
        <div class="kv"><span><b>Net profit</b></span><span class="v ${L.profit >= 0 ? 'good' : 'bad'}"><b>${fmt(L.profit)}</b></span></div>
        ${S.taxLossCarry > 1 ? `<div class="kv"><span>Losses carried forward</span><span class="v">${fmt(S.taxLossCarry)}</span></div>` : ''}
        <div class="kv"><span>Levies paid to date</span><span class="v">${fmt(S.stats.levyTotal || 0)}</span></div>`);
      const parts = [['Cost of goods', sum('cogs'), 'var(--blue)'], ['Wages', sum('wages'), 'var(--violet)'], ['Rent + marketing', sum('fixed'), 'var(--amber)'],
        ['Overhead', sum('overhead'), '#ff9f6b'], ['Upkeep', sum('upkeep') + L.hqUpkeep, '#6bd0ff'], ['Interest', L.interest, '#c08cff'], ['Tax', sum('tax'), 'var(--rose)']];
      const rev = Math.max(1, sum('revenue'));
      setHtml('#ledgerSplit', parts.map(([n, v, c]) => `<div class="kv"><span>${n}</span><span class="v">${pct(v / rev, 1)}</span></div>
        <div class="bar" style="margin:-2px 0 8px"><div class="fill" style="width:${clamp(v / rev * 100, 0, 100)}%;background:${c}"></div></div>`).join('')
        + `<div class="kv"><span><b>Kept as profit</b></span><span class="v ${L.profit >= 0 ? 'good' : 'bad'}"><b>${pct(L.profit / rev, 1)}</b></span></div>`);
      const byNet = [...rows].sort((a, b) => b.net - a.net);
      setHtml('#ledgerBest', rows.length ? `<div class="kv"><span>${byNet[0].icon} ${esc(byNet[0].name)}</span><span class="v good">${money(byNet[0].net)}</span></div>
        <div class="kv"><span>${byNet[byNet.length - 1].icon} ${esc(byNet[byNet.length - 1].name)}</span><span class="v ${byNet[byNet.length - 1].net >= 0 ? '' : 'bad'}">${money(byNet[byNet.length - 1].net)}</span></div>
        <div class="divider"></div>${[...rows].sort((a, b) => b.roi - a.roi).slice(0, 3).map(r => `<div class="kv"><span>${r.icon} ${esc(r.name)}</span><span class="v">${pct(r.roi, 0)} ROI</span></div>`).join('')}`
        : '<div class="muted small">Nothing to report yet.</div>');
    },

    // ============================================================================
    // MARKET
    // ============================================================================
    htmlMarket() {
      const S = G.S;
      const mine = new Set(S.businesses.flatMap(b => BUSINESS_TYPES[b.type].products));
      const pids = Object.keys(PRODUCTS).filter(p => !UI.marketMine || mine.has(p));
      const soldBy = pid => TYPE_ORDER.filter(t => BUSINESS_TYPES[t].products.includes(pid)).map(t => BUSINESS_TYPES[t].icon).join(' ');
      return `<div class="view-title"><div><h1>Market</h1><div class="sub">Wholesale prices move with supply, demand and the season. Big purchases push prices up; they recover over time.</div></div>
        <div class="row"><div class="tabs" style="margin:0"><button class="${UI.marketMine ? 'active' : ''}" data-action="marketMine" data-v="1">My products</button><button class="${!UI.marketMine ? 'active' : ''}" data-action="marketMine" data-v="0">All products</button></div>
        <div class="btngroup">${[1, 3, 7].map(d => `<button class="btn xs ${UI.restockDays === d ? 'primary' : ''}" data-action="setRestockDays" data-days="${d}">${d}d</button>`).join('')}</div><button class="btn sm primary" data-action="restockAll">${I('boxes', 16)}Restock all businesses</button></div></div>
        <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Product</th><th>Category</th><th class="num">Wholesale</th><th>30-day trend</th><th class="num">7d change</th><th>Demand</th><th>Supply</th><th>Sold at</th></tr></thead>
        <tbody>${pids.map(pid => { const p = PRODUCTS[pid]; return `<tr id="mrow-${pid}"><td><b>${p.icon} ${p.name}</b>${p.perishable ? ' <span class="badge">perishable</span>' : ''}</td><td class="muted">${CATEGORIES[p.cat]}</td><td class="num" data-f="cost"></td><td style="width:120px"><canvas data-mspark="${pid}" style="width:110px;height:28px"></canvas></td><td class="num" data-f="ch"></td><td data-f="demand"></td><td data-f="supply"></td><td>${soldBy(pid)}</td></tr>`; }).join('')}</tbody></table></div>
        ${pids.length ? '' : '<div class="empty">No products yet — open a business first.</div>'}</div>
        <div class="card section"><h3>Active market effects</h3><div id="marketEvents"></div></div>`;
    },
    refreshMarket() {
      const S = G.S, fx = G.activeEffects();
      for (const pid in PRODUCTS) {
        const row = $(`#mrow-${pid}`); if (!row) continue;
        const m = S.market[pid], h = m.history, prev = h.length > 7 ? h[h.length - 8] : h[0];
        setText('[data-f="cost"]', fmt(G.buyCost(pid)), row);
        const ch = prev ? (m.cost - prev) / prev : 0;
        setHtml('[data-f="ch"]', `<span class="${ch > 0.02 ? 'bad' : ch < -0.02 ? 'good' : 'muted'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch * 100).toFixed(1)}%</span>`, row);
        const dm = m.demand * fx.demandAll * (fx.demandCat[PRODUCTS[pid].cat] || 1) * (fx.demandProduct[pid] || 1);
        setHtml('[data-f="demand"]', demandBadge(dm), row);
        const sp = m.supply;
        setHtml('[data-f="supply"]', sp < 0.6 ? '<span class="badge bad">Scarce</span>' : sp < 0.85 ? '<span class="badge gold">Tight</span>' : sp > 1.15 ? '<span class="badge good">Glut</span>' : '<span class="badge">Normal</span>', row);
      }
      const ev = S.events.active, season = G.season();
      setHtml('#marketEvents', `<div class="chip" style="margin:0 6px 6px 0">${season.icon} ${season.name} <span class="days">${esc(season.blurb)}</span></div>` + ev.map(e => `<div class="chip ${e.kind === 'bad' ? 'bad' : e.kind === 'good' ? 'good' : ''}" style="margin:0 6px 6px 0">${e.icon} ${esc(e.title)} <span class="days">${e.days}d</span></div>`).join(''));
    },

    // ============================================================================
    // BANK
    // ============================================================================
    htmlBank() {
      const S = G.S;
      return `<div class="view-title"><div><h1>Bank</h1><div class="sub">Credit is backed by tangible assets. Loans are interest-only for ${ECONOMY.loanTerm} days, then repaid over ${ECONOMY.loanAmortDays}. Stay inside your line or the bank calls it.</div></div></div>
        <div id="bankBanner"></div>
        <div class="grid cols-3">
          <div class="card"><h3>Credit line</h3><div class="big-num teal" data-f="avail"></div><div class="small muted">available of <b data-f="limit"></b></div><div class="bar" style="margin-top:8px"><div class="fill gold" data-f="utilbar"></div></div><div class="small muted" style="margin-top:6px">Utilization <b data-f="util"></b> · rate <b data-f="rate"></b>/day</div></div>
          <div class="card"><h3>Take a loan</h3><div class="row"><input class="input" type="number" min="100" step="100" id="loanAmt" placeholder="Amount" style="flex:1"><button class="btn primary" data-action="takeLoan">${I('hand-coins', 16)}Borrow</button></div>
            <div class="btngroup" style="margin-top:8px">${[0.25, 0.5, 1].map(f => `<button class="btn xs" data-action="loanPreset" data-f="${f}">${f * 100}%</button>`).join('')}</div>
            <div class="small muted" style="margin-top:8px">Costs <b data-f="dailycost"></b>/day per ${fmt(10000)}. Max ${5} loans. Term ${ECONOMY.loanTerm} days.</div></div>
          <div class="card"><h3>Runway &amp; levy</h3><div class="big-num" data-f="runway"></div><div class="small muted">of fixed costs covered by cash (<b data-f="fixed"></b>/day)</div><div class="divider"></div><div class="kv"><span>Year-end levy</span><span class="v" data-f="levy"></span></div><div class="kv"><span>Due in</span><span class="v" data-f="levydays"></span></div></div>
        </div>
        <div class="card section"><div class="row between"><h3>Loans</h3><span class="badge">${I('bank', 12)}Debt <b data-f="debt"></b> · interest yesterday <b data-f="interest"></b></span></div>
          ${S.loans.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th class="num">Balance</th><th class="num">Rate</th><th>Term</th><th class="num">Interest paid</th><th></th></tr></thead><tbody>${S.loans.map(l => `<tr id="loan-${l.id}"><td>${l.id}</td><td class="num" data-f="bal"></td><td class="num" data-f="rate"></td><td data-f="term"></td><td class="num" data-f="paid"></td><td class="right"><div class="btngroup"><button class="btn xs" data-action="refinance" data-id="${l.id}" title="Reset the term for a 1% fee">Refinance</button><button class="btn xs" data-action="repay" data-id="${l.id}" data-frac="0.25">Repay 25%</button><button class="btn xs primary" data-action="repay" data-id="${l.id}" data-frac="1">Repay all</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No loans. Debt-free and dangerous.</div>'}
        </div>
        <div class="card section"><h3>Emergency cash</h3><div class="row wrap"><button class="btn sm danger" data-action="liquidateAll">${I('alert', 15)}Sell all inventory (50% of cost)</button><span class="small muted">Raises <b data-f="liq"></b>. Businesses can be sold from their detail page.</span></div></div>`;
    },
    refreshBank() {
      const S = G.S;
      const limit = G.creditLimit(), debt = G.totalDebt(), avail = G.availableCredit();
      setText('[data-f="avail"]', fmt(avail)); setText('[data-f="limit"]', fmt(limit));
      const util = limit > 0 ? debt / limit : 0;
      const ub = $('[data-f="utilbar"]'); if (ub) { ub.style.width = clamp(util * 100, 0, 100) + '%'; ub.className = 'fill ' + (util > 1 ? 'red' : util > 0.8 ? 'gold' : 'green'); }
      setText('[data-f="util"]', pct(util, 0)); setText('[data-f="rate"]', (G.currentRate() * 100).toFixed(2) + '%');
      setText('[data-f="dailycost"]', fmt(10000 * G.currentRate()));
      setText('[data-f="debt"]', fmt(debt)); setText('[data-f="interest"]', fmt(S.lastDay.interest));
      const rw = G.runway(); const rEl = $('[data-f="runway"]'); if (rEl) { rEl.textContent = S.cash < 0 ? 'Overdraft' : runwayLabel(rw); rEl.className = 'big-num ' + (S.cash < 0 || rw < 3 ? 'bad' : rw < 8 ? 'gold' : 'good'); }
      setText('[data-f="fixed"]', fmt(G._dailyFixedCosts(G.activeEffects())));
      setText('[data-f="levy"]', fmt(G.levyDue())); setText('[data-f="levydays"]', `${G.daysToLevy()} days`);
      let banner = '';
      if (S.cash < 0) banner = `<div class="danger-banner">${I('alert', 19)}<span>Overdraft day ${S.overdraftDays}/10 — 1% daily penalty on the negative balance. Get cash above zero.</span></div>`;
      else if (S.marginDays >= ECONOMY.marginCallDays) banner = `<div class="danger-banner">${I('bank', 19)}<span>Margin call in force: debt ${fmt(debt)} vs line ${fmt(limit)}. Penalty rate applies and no new loans until you repay ${fmt(Math.max(0, debt - limit))}. After 30 days the bank sells a business.</span></div>`;
      else if (S.marginDays > 0) banner = `<div class="danger-banner">${I('bank', 19)}<span>Debt exceeds your credit line by ${fmt(Math.max(0, debt - limit))}. Repay within ${ECONOMY.marginCallDays - S.marginDays} days to avoid a margin call.</span></div>`;
      setHtml('#bankBanner', banner);
      const fx = G.activeEffects();
      for (const l of S.loans) { const row = $(`#loan-${l.id}`); if (!row) continue; setText('[data-f="bal"]', fmt(l.amount), row); setText('[data-f="rate"]', (l.rate * fx.rate * 100).toFixed(2) + '%/day', row); setText('[data-f="paid"]', fmt(l.paidInterest), row); const left = l.due - S.day; setHtml('[data-f="term"]', left > 0 ? `<span class="${left <= 10 ? 'gold' : 'muted'}">${left} days left</span>` : `<span class="bad">repaying ${fmt(l.instalment || 0)}/day</span>`, row); }
      setText('[data-f="liq"]', fmt(G.totalInventoryValue() * 0.5));
    },

    // ============================================================================
    // HQ UPGRADES
    // ============================================================================
    htmlHQ() {
      const S = G.S;
      return `<div class="view-title"><div><h1>Headquarters</h1><div class="sub">Company-wide departments. Later tiers unlock behind earlier ones, and every level adds daily upkeep.</div></div>
        <div class="row"><span class="badge">${I('clock', 12)}Head office upkeep <b data-f="hqup"></b>/day</span></div></div>
        <div class="grid cols-2">
        ${Object.keys(HQ_DEPTS).map(dep => {
          const Dp = HQ_DEPTS[dep];
          const ids = Object.keys(HQ_UPGRADES).filter(i => HQ_UPGRADES[i].dept === dep).sort((a, c) => HQ_UPGRADES[a].tier - HQ_UPGRADES[c].tier);
          return `<div class="card dept">
            <div class="branch-head"><span class="emo">${Dp.icon}</span><div><b>${Dp.name}</b><span class="muted small">${Dp.desc}</span></div></div>
            ${ids.map(id => {
              const Hq = HQ_UPGRADES[id], lvl = S.hq[id] || 0, cost = G.hqCost(id), lock = G.hqLock(id);
              return `<div class="upgrade-row ${cost === null ? 'maxed' : ''} ${lock ? 'locked' : ''}" id="hq-${id}">
                <div class="ico">${Hq.icon}</div>
                <div class="info"><b>${Hq.name} ${levelDots(lvl, Hq.max)}</b><span>${Hq.desc}</span>
                  ${lock ? `<span class="lockline">${I('lock', 11)}${esc(lock)}</span>` : cost === null ? '' : `<span class="lockline muted">${I('clock', 11)}Adds ${fmt(cost * Hq.upkeep)}/day upkeep</span>`}</div>
                ${cost === null ? '<span class="badge gold">MAX</span>'
                  : lock ? `<span class="badge">${I('lock', 12)}Locked</span>`
                  : `<button class="btn sm primary" data-action="hq" data-id="${id}" data-f="btn-${id}">${fmt(cost)}</button>`}
              </div>`;
            }).join('')}
          </div>`;
        }).join('')}
          <div class="card"><h3>Subsidiaries</h3>${S.subsidiaries.length ? S.subsidiaries.map(s => `<div class="sub-row" id="sub-${s.id}"><div class="row between"><span>${s.icon} <b>${esc(s.name)}</b> <span class="small muted">${fmt(s.value)}</span></span><span class="v" data-f="income"></span></div><div class="bar" style="margin:6px 0"><div class="fill" data-f="health"></div></div><div class="row between small"><span class="muted" data-f="status"></span><button class="btn xs" data-action="investSub" data-id="${s.id}" data-f="invest"></button></div></div>`).join('') : '<div class="muted small">Acquire rivals from the Rivals tab. They cost money to integrate, then pay you daily — as long as you reinvest before they decay.</div>'}</div>
          <div class="card"><h3>Company stats</h3><div id="hqStats"></div></div>
        </div>`;
    },
    refreshHQ() {
      const S = G.S;
      for (const id in HQ_UPGRADES) { const btn = $(`[data-f="btn-${id}"]`); if (btn) { const c = G.hqCost(id); btn.disabled = c === null || S.cash < c; } }
      setText('[data-f="hqup"]', fmt(G.hqUpkeep()));
      for (const s of S.subsidiaries) {
        const row = $(`#sub-${s.id}`); if (!row) continue;
        const inc = $('[data-f="income"]', row); inc.textContent = `${sign(s.income)}${fmt(s.income)}/day`; inc.className = 'v ' + (s.income >= 0 ? 'good' : 'bad');
        const hb = $('[data-f="health"]', row); hb.style.width = (s.health * 100) + '%'; hb.className = 'fill ' + (s.health >= 0.7 ? 'green' : s.health >= 0.4 ? 'gold' : 'red');
        setText('[data-f="status"]', s.integration > 0 ? `Integrating · ${s.integration} days to go` : `Strength ${Math.round(s.health * 100)}% · decays ${(ECONOMY.subDecay * 100).toFixed(1)}%/day`, row);
        const btn = $('[data-f="invest"]', row); const cost = G.subInvestCost(s); btn.textContent = `Reinvest · ${fmt(cost)}`; btn.disabled = S.cash < cost || s.integration > 0; btn.classList.toggle('primary', s.health < 0.6 && S.cash >= cost && s.integration === 0);
      }
      setHtml('#hqStats', `<div class="kv"><span>Total revenue</span><span class="v">${fmt(S.stats.totalRevenue)}</span></div><div class="kv"><span>Total profit</span><span class="v">${fmt(S.stats.totalProfit)}</span></div><div class="kv"><span>Best single day</span><span class="v">${fmt(S.stats.bestDayProfit || 0)}</span></div><div class="kv"><span>Units sold</span><span class="v">${S.stats.unitsSold.toLocaleString()}</span></div><div class="kv"><span>Peak value</span><span class="v">${fmt(S.stats.peakValue)}</span></div><div class="kv"><span>Trading profit</span><span class="v ${S.stats.tradingProfit >= 0 ? 'good' : 'bad'}">${fmt(S.stats.tradingProfit)}</span></div><div class="kv"><span>Staff who quit</span><span class="v">${S.stats.staffQuit || 0}</span></div><div class="kv"><span>Offers taken</span><span class="v">${S.stats.offersTaken || 0}</span></div><div class="kv"><span>Quests completed</span><span class="v">${S.stats.questsDone}</span></div>`);
    },

    // ============================================================================
    // RIVALS & STOCKS
    // ============================================================================
    htmlRivals() {
      const S = G.S;
      const rows = G.ranking();
      const lb = `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Company</th><th class="num">Value</th><th class="num">7d</th><th>Trend</th><th>Focus</th><th>Status</th><th></th></tr></thead><tbody>
        ${rows.map(r => { const def = r.you ? null : COMPETITORS.find(c => c.id === r.id); const c = def ? G._comp(def.id) : null; return `<tr class="${r.you ? 'you' : ''}" id="rrow-${r.id}"><td><b data-f="rank"></b></td><td>${r.icon} <b>${esc(r.name)}</b>${r.you ? ' <span class="badge teal">YOU</span>' : ''}</td><td class="num" data-f="val"></td><td class="num" data-f="ch"></td><td style="width:110px"><canvas data-rspark="${r.id}" style="width:100px;height:28px"></canvas></td><td class="small muted">${def ? (def.types[0] === '*' ? 'Everything' : def.types.concat(c.extraTypes || []).map(t => BUSINESS_TYPES[t].icon).join(' ')) : '—'}</td><td>${c ? (c.priceWar > 0 ? `<span class="badge bad">⚔️ Price war ${c.priceWar}d</span>` : c.slump > 0 ? '<span class="badge gold">Slump</span>' : '') : (S.raid ? `<span class="badge bad">Under raid</span>` : '')}</td><td class="right">${def ? `<button class="btn xs" data-action="acquire" data-id="${r.id}" data-f="acq"></button>` : ''}</td></tr>`; }).join('')}
        ${S.subsidiaries.map(s => `<tr><td class="muted">—</td><td class="muted">${s.icon} ${esc(s.name)} <span class="badge good">Acquired</span></td><td class="num muted">${fmt(s.value)}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
        ${S.competitors.map((c, i) => c.bust ? `<tr><td class="muted">—</td><td class="muted">${COMPETITORS[i].icon} ${COMPETITORS[i].name} <span class="badge bad">Collapsed</span></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>` : '').join('')}
        </tbody></table></div><div class="small muted" style="margin-top:8px">Acquire a rival when your value is 1.5× theirs and you can pay ${ECONOMY.acquirePremium}× their value in cash. Integration costs money for ${ECONOMY.integrationDays} days, then the subsidiary pays ${(ECONOMY.subIncome * 100).toFixed(1)}% of its value per day while you keep it healthy. Rivals bigger than 2× your size may bid for your company.</div></div>`;
      const stocks = `<div class="grid cols-3"><div class="card"><h3>Portfolio value</h3><div class="big-num gold" data-f="pfval"></div><div class="small muted">unrealized <b data-f="pfpl"></b> · realized <b data-f="realized"></b></div></div><div class="card"><h3>Cash</h3><div class="big-num" data-f="cash"></div><div class="small muted">${(ECONOMY.tradeSpread * 100).toFixed(0)}% bid-ask spread · shares count ${(ECONOMY.shareCollateral * 100).toFixed(0)}% toward credit</div></div><div class="card"><h3>Sentiment</h3><div class="big-num" data-f="sent"></div><div class="small muted">Rivals slump, crash and occasionally collapse. Never borrow to buy shares.</div></div></div>
        <div class="card section"><div class="table-wrap"><table class="table"><thead><tr><th>Company</th><th class="num">Bid / Ask</th><th class="num">7d</th><th class="num">You own</th><th class="num">P&amp;L</th><th>Trade</th></tr></thead><tbody>
        ${COMPETITORS.map((def, i) => { const c = S.competitors[i]; if (c.acquired || c.bust) return ''; return `<tr id="srow-${def.id}"><td>${def.icon} <b>${def.name}</b> <span data-f="status"></span></td><td class="num" data-f="price"></td><td class="num" data-f="ch"></td><td class="num" data-f="own"></td><td class="num" data-f="pl"></td><td><div class="row"><input class="input sm" type="number" min="10" step="100" placeholder="$" data-stockamt="${def.id}"><button class="btn xs primary" data-action="buyStock" data-id="${def.id}">Buy</button><button class="btn xs" data-action="sellStock" data-id="${def.id}" data-frac="0.5">Sell ½</button><button class="btn xs" data-action="sellStock" data-id="${def.id}" data-frac="1">Sell all</button></div></td></tr>`; }).join('')}
        </tbody></table></div></div>`;
      return `<div class="view-title"><div><h1>Rivals &amp; Stocks</h1><div class="sub">Eight AI companies compete for your customers, start price wars, and expand into your sectors. Beat them, trade them, or buy them.</div></div>
        <div class="tabs" style="margin:0"><button class="${UI.rivalsTab === 'leaderboard' ? 'active' : ''}" data-action="rivalsTab" data-tab="leaderboard">${I('trophy', 15)}Leaderboard</button><button class="${UI.rivalsTab === 'stocks' ? 'active' : ''}" data-action="rivalsTab" data-tab="stocks">${I('chart-line', 15)}Stock market</button></div></div>
        ${UI.rivalsTab === 'leaderboard' ? lb : stocks}`;
    },
    refreshRivals() {
      const S = G.S;
      if (UI.rivalsTab === 'leaderboard') {
        const rows = G.ranking();
        for (const r of rows) {
          const row = $(`#rrow-${r.id}`); if (!row) continue;
          setHtml('[data-f="rank"]', r.rank === 1 ? `<span class="gold">${I('crown', 15)} 1</span>` : String(r.rank), row);
          setText('[data-f="val"]', fmt(r.value), row);
          const hist = r.you ? S.history.valuation : r.hist; const prev = hist && hist.length > 7 ? hist[hist.length - 8] : (hist ? hist[0] : null);
          setHtml('[data-f="ch"]', deltaHtml(r.value, prev), row);
          const btn = $('[data-f="acq"]', row);
          if (btn) { const can = G.canAcquire(r.id); btn.disabled = !can; btn.textContent = `Acquire · ${fmt(G.acquisitionPrice(r.id))}`; btn.classList.toggle('gold', can); btn.classList.toggle('glow', can); }
        }
      } else {
        let pfCost = 0; const pfVal = G.portfolioValue();
        for (const cid in S.portfolio) pfCost += S.portfolio[cid].cost;
        setText('[data-f="pfval"]', fmt(pfVal));
        const pl = pfVal - pfCost; const plEl = $('[data-f="pfpl"]'); if (plEl) { plEl.textContent = `${sign(pl)}${fmt(pl)}`; plEl.className = pl >= 0 ? 'good' : 'bad'; }
        const rl = $('[data-f="realized"]'); if (rl) { rl.textContent = `${sign(S.stats.tradingProfit)}${fmt(S.stats.tradingProfit)}`; rl.className = S.stats.tradingProfit >= 0 ? 'good' : 'bad'; }
        setText('[data-f="cash"]', fmt(S.cash));
        setText('[data-f="sent"]', sentimentLabel(S.sentiment));
        for (let i = 0; i < COMPETITORS.length; i++) {
          const def = COMPETITORS[i], c = S.competitors[i]; const row = $(`#srow-${def.id}`); if (!row) continue;
          const mid = c.value / D.SHARES; setText('[data-f="price"]', `${fmt(G.sharePrice(def.id, 'sell'))} / ${fmt(G.sharePrice(def.id, 'buy'))}`, row);
          const prev = c.history.length > 7 ? c.history[c.history.length - 8] : c.history[0]; setHtml('[data-f="ch"]', deltaHtml(c.value, prev), row);
          setHtml('[data-f="status"]', c.slump > 0 ? '<span class="badge gold">Slump</span>' : '', row);
          const pos = S.portfolio[def.id];
          setText('[data-f="own"]', pos ? `${Math.round(pos.shares).toLocaleString()} sh · ${fmt(pos.shares * mid)}` : '—', row);
          const pl2 = pos ? pos.shares * G.sharePrice(def.id, 'sell') - pos.cost : 0; const plE = $('[data-f="pl"]', row); plE.textContent = pos ? `${sign(pl2)}${fmt(pl2)}` : '—'; plE.className = 'num ' + (pl2 >= 0 ? 'good' : 'bad');
        }
      }
    },

    // ============================================================================
    // QUESTS (feed panel)
    // ============================================================================
    renderQuests() {
      const S = G.S, box = $('#questList'); if (!box) return;
      const html = S.quests.map(q => { const p = clamp(q.progress / q.target, 0, 1); const isMoney = ['earn_cash', 'value', 'cash'].includes(q.tid); return `<div class="quest ${q.done ? 'done' : ''}"><div class="row between"><span class="qtxt">${q.done ? I('circle-check', 14) + ' ' : ''}${esc(q.text)}</span><span class="reward">+${fmt(q.reward)}</span></div><div class="qbar"><div class="fill" style="width:${p * 100}%"></div></div><div class="small muted">${isMoney ? fmt(Math.max(0, q.progress)) : Math.floor(Math.max(0, q.progress)).toLocaleString()} / ${isMoney ? fmt(q.target) : q.target.toLocaleString()}</div></div>`; }).join('');
      if (box.innerHTML !== html) box.innerHTML = html;
    },

    // ============================================================================
    // ACTIONS (delegated)
    // ============================================================================
    onClick(e) {
      const el = e.target.closest('[data-action]'); if (!el) return;
      const S = G.S, a = el.dataset.action, id = +el.dataset.id;
      const flash = (ok, msg) => { if (!ok) { toast({ icon: I('circle-x', 20), title: msg || 'Cannot do that', kind: 'bad', ttl: 2500 }); Sound.play('bad'); } };
      switch (a) {
        case 'view': UI.showView(el.dataset.view); return;
        case 'att': {
          const v = el.dataset.view;
          if (v === 'biz') { UI.openBusiness(id); return; }
          if (v === 'matchWar') { const type = el.dataset.id; let n = 0; for (const b of S.businesses) if (b.type === type) { n++; for (const pid in b.prices) G.setPrice(b.id, pid, G.fairPrice(pid) * 0.96); } toast({ icon: '⚔️', title: `Prices set 4% under fair at ${n} ${BUSINESS_TYPES[type] ? BUSINESS_TYPES[type].name : ''}${n === 1 ? '' : 's'}`, ttl: 3000 }); Sound.play('click'); break; }
          UI.showView(v); return;
        }
        case 'openBiz': Sound.play('click'); UI.openBusiness(id); return;
        case 'backBiz': Sound.play('click'); UI.detailBiz = null; UI.render(true); return;
        case 'range': UI.chartRange = +el.dataset.range; UI.render(true); return;
        case 'logscale': UI.chartLog = !UI.chartLog; UI.render(true); return;
        case 'marketMine': UI.marketMine = el.dataset.v === '1'; UI.render(true); return;
        case 'rivalsTab': UI.rivalsTab = el.dataset.tab; UI.render(true); return;
        case 'setRestockDays': UI.restockDays = +el.dataset.days; UI.render(true); return;
        case 'ledgerSort': { const k = el.dataset.key; if (UI.ledgerSort.key === k) UI.ledgerSort.dir *= -1; else UI.ledgerSort = { key: k, dir: k === 'name' ? 1 : -1 }; UI.ledgerDay = -1; UI.refreshLedger(); return; }
        case 'buyBiz': { const r = G.buyBusiness(el.dataset.type); flash(r.ok, r.msg); if (r.ok) floatAt(el, `-${fmt(r.biz.paid)}`, 'bad'); break; }
        case 'sellBiz': { const b = G.biz(id); if (!b) return; Modal.open({ title: `Sell ${b.name}?`, icon: I('tag', 24), body: `<p>You will receive <b class="gold">${fmt(G.bizSaleValue(b))}</b> (55% of purchase price, 40% of upgrades, 50% of inventory). This cannot be undone.</p>`, actions: [{ label: 'Keep it', cls: '' }, { label: 'Sell', cls: 'danger', fn: () => { G.sellBusiness(id); UI.detailBiz = null; UI.render(true); } }] }); return; }
        case 'rename': { const b = G.biz(id); const name = prompt('Rename business:', b.name); if (name) { G.renameBusiness(id, name); } break; }
        case 'buy': case 'buyMax': { const b = G.biz(id), pid = el.dataset.pid; if (!b) return; const exp = G.expectedDemand(b, pid); const qty = a === 'buyMax' ? 1e12 : Math.max(1, Math.ceil(exp * UI.restockDays)); const r = G.buyInventory(id, pid, qty); flash(r.ok, r.msg); if (r.ok) { Sound.play('buy'); floatAt(el, `-${fmt(r.cost)}`, 'bad'); } break; }
        case 'buyAllBiz': { const b = G.biz(id); let spent = 0; for (const pid of BUSINESS_TYPES[b.type].products) { const r = G.buyInventory(id, pid, Math.ceil(G.expectedDemand(b, pid) * UI.restockDays), true); if (r.ok) spent += r.cost; } if (spent) { Sound.play('buy'); floatAt(el, `-${fmt(spent)}`, 'bad'); } else flash(false, 'Nothing bought — storage full or no cash.'); break; }
        case 'restockAll': { let spent = 0; for (const b of S.businesses) for (const pid of BUSINESS_TYPES[b.type].products) { const r = G.buyInventory(b.id, pid, Math.ceil(G.expectedDemand(b, pid) * UI.restockDays), true); if (r.ok) spent += r.cost; } if (spent) { Sound.play('buy'); toast({ icon: I('boxes', 20), title: `Restocked everything for ${fmt(spent)}`, ttl: 3000 }); } else flash(false, 'Nothing to restock (storage full or no cash).'); break; }
        case 'autoAll': { const on = !S.businesses.every(b => b.autoRestock); for (const b of S.businesses) G.setAutoRestock(b.id, on, UI.restockDays + 1); toast({ icon: I('bolt', 20), title: on ? 'Auto-restock enabled everywhere' : 'Auto-restock disabled', ttl: 2500 }); Sound.play('click'); break; }
        case 'pricesAll': for (const b of S.businesses) G.applySuggestedPrices(b.id); toast({ icon: I('tag', 20), title: 'Prices set to suggested levels', ttl: 2500 }); Sound.play('click'); break;
        case 'pricesBiz': G.applySuggestedPrices(id); Sound.play('click'); break;
        case 'priceStep': { const b = G.biz(id), pid = el.dataset.pid; const step = Math.max(0.05, G.fairPrice(pid) * 0.05); G.setPrice(id, pid, b.prices[pid] + step * +el.dataset.dir); Sound.play('click'); break; }
        case 'hire': G.hire(id, +el.dataset.n); Sound.play('click'); break;
        case 'fire': { const r = G.fire(id, +el.dataset.n); flash(r.ok, r.msg); if (r.ok) floatAt(el, `-${fmt(r.severance)} severance`, 'bad'); break; }
        case 'hireRec': { const b = G.biz(id); const rec = G.recommendedStaff(b); if (rec > b.staff) G.hire(id, rec - b.staff); else if (rec < b.staff) G.fire(id, b.staff - rec); Sound.play('click'); break; }
        case 'toggleAuto': { const b = G.biz(id); G.setAutoRestock(id, !b.autoRestock); Sound.play('click'); break; }
        case 'toggleAutoPrice': { const b = G.biz(id); if (!S.hq.analytics) { flash(false, 'Buy the Analytics Suite at HQ first.'); return; } G.setAutoPrice(id, !b.autoPrice); Sound.play('click'); break; }
        case 'upgrade': { const b = G.biz(id); const cost = G.upgradeCost(b, el.dataset.uid); const r = G.buyUpgrade(id, el.dataset.uid); flash(r.ok, r.msg); if (r.ok) { floatAt(el, `-${fmt(cost)}`, 'bad'); toast({ icon: UPGRADES[el.dataset.uid].icon, title: `${UPGRADES[el.dataset.uid].name} Lv.${b.upgrades[el.dataset.uid]} at ${b.name}`, kind: 'good', ttl: 3000 }); } break; }
        case 'hq': { const r = G.buyHqUpgrade(el.dataset.id); flash(r.ok, r.msg); break; }
        case 'investSub': { const r = G.investSubsidiary(el.dataset.id); flash(r.ok, r.msg); if (r.ok) { Sound.play('buy'); floatAt(el, `-${fmt(r.cost)}`, 'bad'); } break; }
        case 'takeLoan': { const amt = +$('#loanAmt').value; const r = G.takeLoan(amt); flash(r.ok, r.msg); if (r.ok) { floatAt(el, `+${fmt(amt)}`, 'gold'); toast({ icon: I('bank', 20), title: `Loan approved: ${fmt(amt)}`, desc: `Interest-only for ${ECONOMY.loanTerm} days, then repaid over ${ECONOMY.loanAmortDays}.`, kind: 'good', ttl: 4000 }); } break; }
        case 'loanPreset': $('#loanAmt').value = Math.floor(G.availableCredit() * +el.dataset.f); return;
        case 'repay': { const loan = S.loans.find(l => l.id === id); if (!loan) return; const r = G.repayLoan(id, Math.ceil(loan.amount * +el.dataset.frac)); flash(r.ok, r.msg); if (r.ok) Sound.play('cash'); break; }
        case 'refinance': { const r = G.refinanceLoan(id); flash(r.ok, r.msg); if (r.ok) { Sound.play('cash'); toast({ icon: I('bank', 20), title: `Refinanced for ${fmt(r.fee)}`, desc: `Fresh ${ECONOMY.loanTerm}-day term at today's rate.`, ttl: 3500 }); } break; }
        case 'liquidateAll': { Modal.open({ title: 'Sell all inventory?', icon: I('alert', 24), body: `<p>Every unit in every store will be sold at half its cost, raising about <b class="gold">${fmt(G.totalInventoryValue() * 0.5)}</b>. Your shelves will be empty tomorrow.</p>`, actions: [{ label: 'Cancel' }, { label: 'Sell everything', cls: 'danger', fn: () => { let got = 0; for (const b of S.businesses) for (const pid in b.stock) { const r = G.sellInventory(b.id, pid, b.stock[pid]); if (r.ok) got += r.value; } toast({ icon: I('boxes', 20), title: `Liquidated inventory for ${fmt(got)}`, ttl: 4000 }); UI.render(true); } }] }); return; }
        case 'buyStock': { const inp = $(`[data-stockamt="${el.dataset.id}"]`); const r = G.buyShares(el.dataset.id, +inp.value || 0); flash(r.ok, r.msg); if (r.ok) { Sound.play('buy'); inp.value = ''; } break; }
        case 'sellStock': { const pos = S.portfolio[el.dataset.id]; if (!pos) { flash(false, 'You own no shares.'); return; } const r = G.sellShares(el.dataset.id, pos.shares * +el.dataset.frac); flash(r.ok, r.msg); if (r.ok) { Sound.play('cash'); floatAt(el, `${sign(r.profit)}${fmt(r.profit)}`, r.profit >= 0 ? 'good' : 'bad'); } break; }
        case 'acquire': { const def = COMPETITORS.find(c => c.id === el.dataset.id); const c = G._comp(def.id); Modal.open({ title: `Acquire ${def.name}?`, icon: def.icon, body: `<p>Pay <b class="gold">${fmt(G.acquisitionPrice(def.id))}</b> in cash (${ECONOMY.acquirePremium}× their value) to absorb ${def.name}. They stop competing with you. Integration costs <b>${fmt(c.value * ECONOMY.integrationCost)}/day</b> for ${ECONOMY.integrationDays} days, then the subsidiary pays up to <b>${fmt(c.value * ECONOMY.subIncome)}/day</b> while you keep reinvesting.</p>`, actions: [{ label: 'Not yet' }, { label: 'Sign the deal', cls: 'gold', fn: () => { const r = G.acquireCompetitor(def.id); flash(r.ok, r.msg); UI.render(true); } }] }); return; }
        case 'acceptOffer': { const r = G.acceptOffer(id); flash(r.ok, r.msg); if (r.ok) { Sound.play('buy'); UI.render(true); } return; }
        case 'declineOffer': G.declineOffer(id); Sound.play('click'); UI.render(true); return;
        default: return;
      }
      UI.render(false);
    },
    onInput(e) {
      const el = e.target; const k = el.dataset.input; if (!k) return;
      const id = +el.dataset.id;
      if (k === 'wage') { G.setWage(id, +el.value); UI.refreshBizDetail(); }
      else if (k === 'marketing') { G.setMarketing(id, +el.value); UI.refreshBizDetail(); }
      else if (k === 'price') { const v = parseFloat(el.value); if (v > 0) { G.setPrice(id, el.dataset.pid, v); } }
    },
    onChange(e) {
      const el = e.target; const k = el.dataset.input; if (!k) return;
      const id = +el.dataset.id;
      if (k === 'stockDays') { G.setAutoRestock(id, G.biz(id).autoRestock, +el.value); }
      else if (k === 'price') { const b = G.biz(id); if (b) el.value = b.prices[el.dataset.pid]; UI.refreshBizDetail(); }
    },

    // ============================================================================
    // MODALS
    // ============================================================================
    showChoice(p) {
      if (!p || !p.def || !p.def.choices) { if (G.S.events.pending) G.resolveChoice(1); return; }
      H.pause(true);
      const m = Modal.open({ title: p.def.title, icon: p.def.icon, cls: 'event-choice', body: `<p>${esc(p.desc)}</p><p class="small muted">The game is paused while you decide.</p>`,
        actions: p.def.choices.map((c, i) => ({ label: G._fill(c.label, p.param), cls: i === 0 ? (p.def.id === 'hostile_bid' ? 'danger' : 'primary') : (p.def.id === 'hostile_bid' ? 'primary' : ''), fn: () => { G.resolveChoice(i); UI.render(true); } })),
        onClose: () => { if (G.S.events.pending) G.resolveChoice(p.def.choices.length - 1); H.pause(false); } });
      m._locked = true;
    },
    showHelp() {
      Modal.open({ title: 'How to play', icon: I('help', 24), wide: true, body: `
        <ul class="help-list">
          <li><b>Goal:</b> grow your company value from $1,000 to <b>$1,000,000,000</b> (doubles with every IPO). Value = net assets + goodwill, a multiple of your average daily after-tax profit that rises with growth, sentiment and your profit streak.</li>
          <li><b>Dashboard:</b> "Needs attention" tells you what to fix, "Timed offers" are deals that expire while the clock runs. The top bar shows your cash <b>runway</b>: days of fixed costs you can cover.</li>
          <li><b>Businesses:</b> buy inventory at wholesale, set prices, hire enough staff. New hires train for ${ECONOMY.traineeDays} days; underpaid staff quit. Reputation drifts back to 50 unless you earn it with full shelves, good service and fair prices.</li>
          <li><b>Bank:</b> loans are interest-only for ${ECONOMY.loanTerm} days, then repaid over ${ECONOMY.loanAmortDays}. Refinance to reset the term. If debt exceeds your credit line for ${ECONOMY.marginCallDays} days the bank calls it. Cash below zero for 10 days is <b>bankruptcy</b>.</li>
          <li><b>Calendar:</b> a year is 360 days with four seasons that tilt demand. On day 360 a <b>levy of ${(ECONOMY.annualLevy * 100).toFixed(0)}% of company value</b> is due, and you get a graded annual report.</li>
          <li><b>Rivals:</b> they expand into your sectors, start <b>price wars</b> (match fair prices to keep customers), slump, crash and occasionally collapse. Bigger rivals may make a <b>hostile bid</b> for your company. Trade their shares at a spread, or acquire them at ${ECONOMY.acquirePremium}× value and keep the subsidiary reinvested.</li>
          <li><b>Costs:</b> wages inflate as you grow, overhead grows with business count, every upgrade level has upkeep, and corporate tax is progressive. Losses carry forward.</li>
          <li><b>Legacy:</b> winning lets you <b>Go Public</b>: keep Legacy points for permanent perks and start again against a target twice as high. The <b>Daily Sprint</b> is a seeded ${DAILY.days}-day run scored on final value.</li>
          <li><b>Keys:</b> <b>Space</b> pause · <b>1-4</b> speed · <b>D B L M K H R</b> switch tabs · <b>Esc</b> close.</li>
        </ul>`, actions: [{ label: 'Got it', cls: 'primary' }] });
    },
    showAchievements() {
      const S = G.S;
      Modal.open({ title: `Achievements (${Object.keys(S.achievements).length}/${ACHIEVEMENTS.length})`, icon: I('medal', 24), wide: true, body: `<div class="ach-grid">${ACHIEVEMENTS.map(a => { const got = S.achievements[a.id]; return `<div class="ach ${got ? (S.day - got < 3 ? 'new' : '') : 'locked'}"><div class="ico">${a.icon}</div><b>${a.name}</b><span>${a.desc}</span>${a.bonus ? `<span class="gold">+${fmt(a.bonus)}</span>` : ''}${got ? `<span>Day ${got}</span>` : ''}</div>`; }).join('')}</div>`, actions: [{ label: 'Close', cls: 'primary' }] });
    },
    showMenu() {
      const wasPaused = H.isPaused(); H.pause(true);
      const resume = () => { if (!wasPaused) H.pause(false); };
      Modal.open({ title: 'Menu', icon: I('menu', 24), body: `<p class="muted small">Progress autosaves every 5 days and whenever you leave the page.</p>`, actions: [
        { label: 'Resume', icon: 'play', cls: 'primary', fn: resume },
        { label: 'How to play', icon: 'help', fn: () => { UI.showHelp(); $('#modal')._onClose = resume; return true; } },
        { label: 'Achievements', icon: 'medal', fn: () => { UI.showAchievements(); $('#modal')._onClose = resume; return true; } },
        { label: 'Legacy', icon: 'trophy', fn: () => { UI.showLegacy(); $('#modal')._onClose = resume; return true; } },
        { label: Sound.muted ? 'Sound on' : 'Sound off', icon: Sound.muted ? 'sound-off' : 'sound-on', fn: () => { Sound.toggle(); if (!Sound.muted) Sound.play('click'); UI.showMenu(); return true; } },
        { label: 'Save now', icon: 'save', fn: () => { H.save(); toast({ icon: I('save', 20), title: 'Game saved', ttl: 2000 }); resume(); } },
        { label: UI.debug ? 'Hide diagnostics' : 'Diagnostics', icon: 'activity', fn: () => { UI.setDebug(!UI.debug); resume(); } },
        { label: 'New game', icon: 'refresh', cls: 'danger', fn: () => { Modal.open({ title: 'Start over?', icon: I('alert', 24), body: '<p>Your current company will be deleted. This cannot be undone.</p>', actions: [{ label: 'Cancel', fn: resume }, { label: 'Delete & restart', cls: 'danger', fn: () => H.newGame() }] }); return true; } },
      ], onClose: () => { if (!wasPaused && !Modal.isOpen()) H.pause(false); } });
    },
    // Legacy: the persistent record across runs, and the perk shop.
    showLegacy() {
      const meta = H.meta();
      const prevClose = Modal.isOpen() && $('#modal')._legacy ? $('#modal')._onClose : null; // re-render after a perk purchase keeps the close handler
      const perks = Object.keys(PRESTIGE.perks).map(id => { const P = PRESTIGE.perks[id], lvl = meta.perks[id] || 0; const maxed = lvl >= P.max; return `<div class="upgrade-row ${maxed ? 'maxed' : ''}"><div class="ico">${P.icon}</div><div class="info"><b>${P.name} ${levelDots(lvl, P.max)}</b><span>${P.desc}</span></div>${maxed ? '<span class="badge gold">MAX</span>' : `<button class="btn sm ${meta.points >= P.cost ? 'primary' : ''}" data-perk="${id}" ${meta.points >= P.cost ? '' : 'disabled'}>${P.cost} pt${P.cost > 1 ? 's' : ''}</button>`}</div>`; }).join('');
      const runs = meta.runs.slice(0, 6).map(r => `<div class="kv"><span>${r.won ? (r.soldOut ? '🦈' : '🏆') : r.bankrupt ? '💀' : '⏱️'} ${esc(r.company)} · ${DIFFICULTY[r.difficulty] ? DIFFICULTY[r.difficulty].name : ''}</span><span class="v">${fmt(r.valuation)} · day ${r.day}${r.points ? ` · +${r.points} pts` : ''}</span></div>`).join('') || '<div class="muted small">No finished runs yet.</div>';
      const daily = Object.keys(meta.daily).sort().reverse().slice(0, 5).map(d => `<div class="kv"><span>${d}</span><span class="v">${fmt(meta.daily[d].valuation)}</span></div>`).join('') || '<div class="muted small">No sprints yet.</div>';
      Modal.open({ title: 'Legacy', icon: I('trophy', 24), wide: true, body: `
        <div class="legacy-head"><div><div class="hero-label">IPOs</div><div class="big-num gold">${meta.level}</div></div><div><div class="hero-label">Legacy points</div><div class="big-num">${meta.points}</div></div><div><div class="hero-label">Next target</div><div class="big-num" style="font-size:22px">${fmt(D.WIN_VALUE * Math.pow(PRESTIGE.targetGrowth, meta.level))}</div></div></div>
        <p class="small muted">Win a run and <b>Go Public</b> to earn points: faster wins and Hard difficulty pay more. Perks apply to every future run. Each IPO doubles the target and makes tax and rivals ${Math.round(PRESTIGE.taxPerLevel * 100)}% and ${Math.round(PRESTIGE.rivalPerLevel * 100)}% tougher.</p>
        ${perks}
        <div class="grid cols-2" style="margin-top:14px"><div><h3 style="margin:0 0 6px;font-size:10.5px;letter-spacing:1.3px;text-transform:uppercase;color:var(--ink-4)">Recent runs</h3>${runs}</div><div><h3 style="margin:0 0 6px;font-size:10.5px;letter-spacing:1.3px;text-transform:uppercase;color:var(--ink-4)">Daily sprints</h3>${daily}</div></div>`,
        actions: [{ label: 'Close', cls: 'primary' }], onClose: prevClose });
      $('#modal')._legacy = true;
    },
    showWin() {
      const S = G.S;
      Confetti.burst(400, { power: 14 }); Sound.play('win');
      setTimeout(() => Confetti.burst(250, { power: 12, x: root.innerWidth * 0.25 }), 700);
      setTimeout(() => Confetti.burst(250, { power: 12, x: root.innerWidth * 0.75 }), 1400);
      const m = Modal.open({ title: 'YOU DID IT!', icon: '🏆', cls: 'win', body: `<p style="font-size:16px">${esc(S.company)} is worth <b class="gold">${fmt(S.valuation)}</b>. From a corner store with $1,000 to the target of ${fmt(S.winValue)} in <b>${S.day} days</b>.</p>
        ${UI.runStatsHtml()}
        <p class="muted small"><b>Go Public</b> floats the company: you earn Legacy points for perks and start a new run with a target of ${fmt(S.winValue * PRESTIGE.targetGrowth)}. Or keep playing to crush every rival.</p>`,
        actions: [{ label: 'Go Public', icon: 'rocket', cls: 'gold', fn: () => { const r = H.goPublic(); if (r && r.ok) { Modal.open({ title: `IPO complete · +${r.points} Legacy points`, icon: '🏛️', cls: 'win', body: `<p>${esc(S.company)} is now public. Spend your points on perks, then start IPO #${r.level + 1}.</p>`, actions: [{ label: 'Legacy & perks', icon: 'trophy', cls: 'primary', fn: () => { UI.showLegacy(); $('#modal')._onClose = () => H.newGame({ keepMeta: true }); return true; } }, { label: 'Start next run', icon: 'refresh', cls: 'gold', fn: () => H.newGame({ keepMeta: true }) }] }); $('#modal')._locked = true; return true; } } },
          { label: 'Keep playing', icon: 'play', fn: () => { S.flags.continued = true; H.pause(false); } }], onClose: () => H.pause(false) });
      m._locked = true;
    },
    runStatsHtml() {
      const S = G.S, ms = S.stats.milestones || {};
      const fast = Object.keys(ms).map(k => +k).filter(k => k >= 1e5 && k <= 1e9 && ms[k]).sort((a, b) => a - b).map(k => `${fmt(k)} @ day ${ms[k]}`).join(' · ');
      return statGrid([['Businesses', S.businesses.length], ['Employees', G.totalStaff()], ['Total profit', fmt(S.stats.totalProfit)], ['Best day', fmt(S.stats.bestDayProfit || 0)], ['Peak value', fmt(S.stats.peakValue)], ['Market rank', `#${S.rank}`], ['Achievements', `${Object.keys(S.achievements).length}/${ACHIEVEMENTS.length}`], ['Tax paid', fmt(S.stats.taxPaid)]]) + (fast ? `<p class="small muted">Milestones: ${fast}</p>` : '');
    },
    showSoldOut(p) {
      const S = G.S; Sound.play('cash');
      const m = Modal.open({ title: 'Sold out', icon: '🦈', cls: 'win', body: `<p>${esc(S.company)} was bought by ${esc(p.rival)} for <b class="gold">${fmt(p.fee)}</b> on day ${S.day}. Not the billion, but a very comfortable retirement.</p>${UI.runStatsHtml()}<p class="muted small">Selling counts as a win for Legacy, at one point less than an IPO.</p>`,
        actions: [{ label: 'Go Public with the proceeds', icon: 'rocket', cls: 'gold', fn: () => { const r = H.goPublic(); if (r && r.ok) { toast({ icon: '🏛️', title: `+${r.points} Legacy points`, kind: 'gold', ttl: 5000 }); H.newGame({ keepMeta: true }); } } }, { label: 'New game', icon: 'refresh', fn: () => H.newGame() }] });
      m._locked = true;
    },
    showSprintDone(p) {
      const S = G.S; Sound.play('win'); Confetti.burst(200, { power: 10 });
      const meta = H.recordRun();
      const best = meta.daily[S.challenge];
      const share = `Market Mayhem Daily Sprint ${S.challenge}: ${fmt(S.valuation)} in ${DAILY.days} days with ${S.businesses.length} businesses. Beat me!`;
      const m = Modal.open({ title: `${DAILY.name} complete`, icon: '⏱️', cls: 'win', body: `<p>${esc(S.company)} finished ${S.challenge} worth <b class="gold">${fmt(S.valuation)}</b>.${best && best.valuation > S.valuation + 1 ? ` Your best for this date is ${fmt(best.valuation)}.` : ' A new best for this date!'}</p>${UI.runStatsHtml()}<p class="small muted">Everyone playing this date gets the same markets and events. Share your score and see who runs it best.</p>`,
        actions: [{ label: 'Copy score', icon: 'scroll', fn: () => { H.copyText(share); toast({ icon: I('scroll', 20), title: 'Score copied', desc: share, ttl: 5000 }); return true; } }, { label: 'Try again', icon: 'refresh', cls: 'gold', fn: () => H.newGame({ daily: true }) }, { label: 'Main menu', icon: 'arrow-left', fn: () => H.newGame() }] });
      m._locked = true;
    },
    showBankrupt() {
      const S = G.S; Sound.play('bad');
      H.recordRun();
      const m = Modal.open({ title: 'BANKRUPT', icon: '💀', cls: 'dead', body: `<p>${esc(S.company)} could not pay its debts. The bank has seized everything.</p>
        ${statGrid([['Survived', `${S.day} days`], ['Peak value', fmt(S.stats.peakValue)], ['Businesses owned', S.stats.bizBought + 1], ['Total revenue', fmt(S.stats.totalRevenue)], ['Best day', fmt(S.stats.bestDayProfit || 0)], ['Margin calls', S.stats.marginCalls || 0]])}
        <p class="muted small">Tip: watch the runway in the top bar, keep cash for loan terms and the year-end levy, and never let an overdraft run.</p>`,
        actions: [{ label: 'Try again', icon: 'refresh', cls: 'primary', fn: () => H.newGame() }] });
      m._locked = true;
    },
    showAnnualReport(r) {
      const S = G.S;
      const cls = r.grade.startsWith('A') ? 'good' : r.grade === 'F' || r.grade === 'D' ? 'bad' : 'gold';
      toast({ icon: '📅', title: `Year ${r.year} report: grade ${r.grade}`, desc: `Value ${fmt(r.startValue)} → ${fmt(r.endValue)}. Levy paid ${fmt(r.levy)}.`, kind: cls === 'good' ? 'gold' : cls === 'bad' ? 'bad' : '', ttl: 9000 });
      if (cls === 'good') { Sound.play('achievement'); Confetti.burst(120, { power: 8 }); } else Sound.play(cls === 'bad' ? 'bad' : 'good');
      if (H.getSpeed() <= 2 || r.grade === 'F') {
        H.pause(true);
        Modal.open({ title: `Year ${r.year} annual report`, icon: '📅', body: `<div class="report-grade ${cls}">${r.grade}</div>${statGrid([['Value at start', fmt(r.startValue)], ['Value at end', fmt(r.endValue)], ['Profit this year', fmt(r.profit)], ['Year-end levy', fmt(r.levy)], ['Businesses', r.businesses], ['Cash now', fmt(S.cash)]])}<p class="small muted">${r.grade === 'F' ? 'The company shrank. Fix the losers in the Ledger before the next levy.' : r.grade.startsWith('A') ? 'Investors are thrilled. Keep the streak alive.' : 'Solid. Faster growth needs bigger bets — and the cash to survive them.'}</p>`, actions: [{ label: 'Onward', cls: 'primary' }], onClose: () => H.pause(false) });
      }
    },
    showOffline(r) {
      const o = r.offer;
      Modal.open({ title: 'While you were away', icon: I('clock', 24), body: `<p>Your managers ran the empire for <b>${r.days} days</b>.</p>${statGrid([['Cash', `${sign(r.cashDelta)}${fmt(r.cashDelta)}`, r.cashDelta >= 0 ? 'good' : 'bad'], ['Company value', `${sign(r.valueDelta)}${fmt(r.valueDelta)}`, r.valueDelta >= 0 ? 'good' : 'bad']])}${o ? `<div class="offer"><div class="offer-head"><span class="emo">${o.icon}</span><b>${esc(o.title)}</b><span class="badge gold">${o.expires - G.S.day}d left</span></div><div class="small muted">${esc(o.desc)}</div></div><p class="small muted">One decision is waiting on the dashboard.</p>` : ''}`, actions: [{ label: 'Back to work', cls: 'primary' }] });
    },
    setDebug(on) {
      UI.debug = !!on;
      let d = $('#diag');
      if (!on) { if (d) d.remove(); return; }
      if (!d) { d = document.createElement('div'); d.id = 'diag'; document.body.appendChild(d); }
      UI.renderDiag();
    },
    renderDiag() {
      const d = $('#diag'); if (!d) return;
      const st = (root.MM && root.MM.stats) || {};
      const S = G.S;
      const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'n/a';
      const err = st.errors && st.errors[0] ? st.errors[0].msg.split('\n')[0] : 'none';
      d.innerHTML = `<b>DIAGNOSTICS</b> fps ${st.fps || 0} · frame ${(st.frameMs || 0).toFixed(1)}ms · tick ${(st.tickMs || 0).toFixed(2)}ms · day ${S ? S.day : '-'} · speed ${H.getSpeed()}x · pending ${S && S.events.pending ? 'YES' : 'no'} · modal ${Modal.isOpen() ? 'open' : 'closed'} · biz ${S ? S.businesses.length : 0} · heap ${mem}<br>${esc(navigator.userAgent.slice(0, 90))}<br>last error: ${esc(err)}`;
    },
    toast, Modal, Sound, Confetti, floatAt,
  };

  root.MM_UI = UI;
})(window);
