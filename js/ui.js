/* =========================================================================
   MARKET MAYHEM — UI layer: views, bindings, toasts, modals, juice
   ========================================================================= */
(function (root) {
  'use strict';
  const D = root.MM_DATA, Charts = root.MM_CHARTS;
  const { PRODUCTS, BUSINESS_TYPES, TYPE_ORDER, UPGRADES, HQ_UPGRADES, COMPETITORS, CATEGORIES, ACHIEVEMENTS, TIPS, DIFFICULTY } = D;
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
      }
    },
    toggle() { this.muted = !this.muted; try { localStorage.setItem('mm_muted', this.muted ? '1' : '0'); } catch (e) { /* ignore */ } return this.muted; },
  };

  // ============================================================================
  // Toasts, floaters, confetti, modal
  // ============================================================================
  function toast({ icon = '💬', title = '', desc = '', kind = '', ttl = 4500 }) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = `<div class="ico">${icon}</div><div><div class="t">${esc(title)}</div>${desc ? `<div class="d">${esc(desc)}</div>` : ''}</div>`;
    box.appendChild(el);
    const maxToasts = root.innerWidth <= 760 ? 2 : 4;
    while (box.children.length > maxToasts) box.removeChild(box.firstChild);
    const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
    el.addEventListener('click', kill);
    setTimeout(kill, ttl);
  }
  function floatAt(el, text, kind = 'good') {
    if (!el) return;
    const now = performance.now();
    if (el._lastFloat && now - el._lastFloat < 650) return; // avoid piles of overlapping floaters
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
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      this.parts = this.parts.filter(p => p.life > 0 && p.y < h + 20);
      for (const p of this.parts) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.r += p.vr; p.life--;
        const c = Math.cos(p.r), sn = Math.sin(p.r);
        ctx.setTransform(dpr * c, dpr * sn, -dpr * sn, dpr * c, dpr * p.x, dpr * p.y);
        ctx.globalAlpha = Math.min(1, p.life / 30); ctx.fillStyle = p.color; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
      if (!this.parts.length) { this.running = false; ctx.clearRect(0, 0, w, h); }
    },
  };

  const Modal = {
    stack: [],
    open({ title = '', icon = '', body = '', actions = [], cls = '', wide = false, onClose = null }) {
      const m = $('#modal');
      m.innerHTML = `<div class="modal-box ${cls} ${wide ? 'wide' : ''}">
        ${title ? `<h2>${icon ? `<span class="ico">${icon}</span>` : ''}<span>${esc(title)}</span></h2>` : ''}
        <div class="modal-body">${body}</div>
        <div class="modal-actions">${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-mi="${i}">${esc(a.label)}</button>`).join('')}</div>
      </div>`;
      m.classList.remove('hidden');
      m._actions = actions; m._onClose = onClose; m._locked = false;
      $$('[data-mi]', m).forEach(b => b.addEventListener('click', () => {
        const a = actions[+b.dataset.mi];
        Sound.play('click');
        if (a.fn) { const keep = a.fn(); if (keep === true) return; }
        Modal.close();
      }));
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
    if (prev == null || prev === 0) return '<span class="muted">—</span>';
    const d = (now - prev) / Math.abs(prev);
    const good = invert ? d <= 0 : d >= 0;
    return `<span class="${good ? 'good' : 'bad'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d * 100).toFixed(1)}%</span>`;
  }
  function dateLabel(day) { const y = Math.floor((day - 1) / 360) + 1, m = Math.floor(((day - 1) % 360) / 30) + 1, d = ((day - 1) % 30) + 1; return `Year ${y} · Month ${m} · Day ${d}`; }
  function levelDots(lvl, max) { let s = '<div class="lvl">'; for (let i = 0; i < max; i++) s += `<i class="${i < lvl ? 'on' : ''}"></i>`; return s + '</div>'; }
  function demandBadge(m) {
    if (m >= 1.4) return '<span class="badge gold">🔥 Hot</span>';
    if (m >= 1.12) return '<span class="badge good">↑ High</span>';
    if (m <= 0.7) return '<span class="badge bad">🧊 Cold</span>';
    if (m <= 0.88) return '<span class="badge bad">↓ Low</span>';
    return '<span class="badge">→ Normal</span>';
  }
  function priceBadge(ratio) {
    if (ratio < 0.9) return '<span class="badge teal">Cheap</span>';
    if (ratio <= 1.15) return '<span class="badge good">Fair</span>';
    if (ratio <= 1.4) return '<span class="badge gold">Pricey</span>';
    return '<span class="badge bad">Gouging</span>';
  }
  function moraleLabel(w) { return w >= 1.3 ? '🤩 Thrilled' : w >= 1.1 ? '😀 Happy' : w >= 0.9 ? '😐 Content' : w >= 0.7 ? '😕 Grumbling' : '😠 Angry'; }
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
  function setWidth(sel, w, el) { const n = $(sel, el); if (n) n.style.width = clamp(w, 0, 100) + '%'; }

  // ============================================================================
  // UI object
  // ============================================================================
  const UI = {
    view: 'dashboard', detailBiz: null, rivalsTab: 'leaderboard', marketMine: true, chartRange: 90, chartLog: false,
    lastRefresh: 0, lastChart: 0, structKey: '', mountedView: '', navDots: {}, restockDays: 3, tipIndex: 0, lastTipDay: -100,

    init(game, hooks) {
      G = game; H = hooks; fmt = n => G.fmt(n);
      Sound.init();
      $('#btnMute').textContent = Sound.muted ? '🔇' : '🔊';
      // nav
      $$('.navbtn').forEach(b => b.addEventListener('click', () => { Sound.play('click'); UI.showView(b.dataset.view); }));
      $('#speedCtl').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Sound.play('click'); H.setSpeed(+b.dataset.speed); UI.updateSpeedButtons(); });
      $('#btnHelp').addEventListener('click', () => { Sound.play('click'); UI.showHelp(); });
      $('#btnAch').addEventListener('click', () => { Sound.play('click'); UI.showAchievements(); });
      $('#btnMute').addEventListener('click', () => { const m = Sound.toggle(); $('#btnMute').textContent = m ? '🔇' : '🔊'; if (!m) Sound.play('click'); });
      $('#btnMenu').addEventListener('click', () => { Sound.play('click'); UI.showMenu(); });
      $('#btnFeed').addEventListener('click', () => { Sound.play('click'); document.body.classList.toggle('feed-open'); const d = $('#btnFeed .dot'); if (d) d.remove(); });
      $('#btnFeedClose').addEventListener('click', () => document.body.classList.remove('feed-open'));
      // delegated actions inside the main view
      const view = $('#view');
      view.addEventListener('click', e => UI.onClick(e));
      view.addEventListener('input', e => UI.onInput(e));
      view.addEventListener('change', e => UI.onChange(e));
      view.addEventListener('mousemove', e => { const c = e.target.closest('canvas[data-hover]'); if (c) { c._hover = e.offsetX; UI.lastChart = 0; } });
      view.addEventListener('mouseleave', () => { $$('canvas[data-hover]', view).forEach(c => { c._hover = null; }); UI.lastChart = 0; });
      $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('#modal')._locked) Modal.close(); });
      game.on((type, p) => UI.onGameEvent(type, p));
    },

    // ---------- game events → feedback -------------------------------------------
    onGameEvent(type, p) {
      const S = G.S;
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
        case 'eventEnd': toast({ icon: p.ev.icon, title: `${p.ev.title} is over`, ttl: 3500 }); break;
        case 'choice': H.pause(true); UI.showChoice(p); break;
        case 'choiceResolved': toast({ icon: p.icon, title: p.msg, ttl: 5000 }); break;
        case 'unlock': toast({ icon: BUSINESS_TYPES[p.type].icon, title: `Unlocked: ${BUSINESS_TYPES[p.type].name}`, desc: BUSINESS_TYPES[p.type].blurb, kind: 'gold', ttl: 8000 }); Sound.play('unlock'); UI.navDots.businesses = true; UI.updateNavDots(); break;
        case 'achievement': toast({ icon: p.a.icon, title: `Achievement: ${p.a.name}`, desc: p.a.desc + (p.a.bonus ? ` Reward: ${fmt(p.a.bonus)}` : ''), kind: 'purple', ttl: 8000 }); Sound.play('achievement'); Confetti.burst(60, { power: 6 }); if (p.a.bonus) floatAt($('#topCash'), `+${fmt(p.a.bonus)}`, 'gold'); break;
        case 'quest': toast({ icon: '📜', title: 'Quest complete!', desc: `${p.q.text} — reward ${fmt(p.q.reward)}`, kind: 'gold', ttl: 7000 }); Sound.play('cash'); floatAt($('#topCash'), `+${fmt(p.q.reward)}`, 'gold'); break;
        case 'rankUp': toast({ icon: '🏁', title: p.passed ? `You overtook ${p.passed}!` : 'Rank up!', desc: `You are now #${p.rank} on the market leaderboard.`, kind: 'good', ttl: 6000 }); Sound.play('good'); break;
        case 'taunt': toast({ icon: p.icon, title: p.name, desc: p.text, ttl: 6000 }); break;
        case 'bigSale': toast({ icon: PRODUCTS[p.pid].icon, title: `${p.sold > 1 ? p.sold + '× ' : ''}${PRODUCTS[p.pid].name} sold!`, desc: `${p.biz.name} closed a deal worth ${fmt(p.price * p.sold)}.`, kind: 'good', ttl: 5000 }); Sound.play('cash'); break;
        case 'overdraft': toast({ icon: '⚠️', title: 'Overdraft!', desc: `Cash is negative. Fix it within ${p.days} days or go bankrupt.`, kind: 'bad', ttl: 9000 }); Sound.play('alarm'); $('#app').classList.add('shake'); setTimeout(() => $('#app').classList.remove('shake'), 600); break;
        case 'overdraftWarning': toast({ icon: '🚨', title: `Bankruptcy in ${p.left} days!`, desc: 'Sell inventory, sell a business, or take a loan now.', kind: 'bad', ttl: 9000 }); Sound.play('alarm'); break;
        case 'bankrupt': H.pause(true); UI.showBankrupt(); break;
        case 'win': H.pause(true); UI.showWin(); break;
        case 'bizBought': toast({ icon: BUSINESS_TYPES[p.biz.type].icon, title: `${p.biz.name} is open!`, desc: 'Auto-restock is on. Check staffing and prices.', kind: 'good', ttl: 6000 }); Sound.play('buy'); Confetti.burst(50, { power: 6 }); break;
        case 'bizSold': toast({ icon: '🏷️', title: `Sold ${p.biz.name}`, desc: `Received ${fmt(p.value)}.`, ttl: 5000 }); break;
        case 'acquired': toast({ icon: p.icon, title: `Acquired ${p.name}!`, desc: `A new subsidiary joins your empire for ${fmt(p.price)}.`, kind: 'gold', ttl: 8000 }); Sound.play('win'); Confetti.burst(150, { power: 10 }); break;
        case 'upgrade': Sound.play('buy'); break;
        case 'hqUpgrade': Sound.play('buy'); toast({ icon: HQ_UPGRADES[p.id].icon, title: `${HQ_UPGRADES[p.id].name} Lv.${p.level}`, desc: HQ_UPGRADES[p.id].desc, kind: 'good', ttl: 4000 }); break;
        case 'loan': Sound.play('cash'); break;
      }
    },

    addFeed(item) {
      const list = $('#feedList'); if (!list) return;
      const el = document.createElement('div');
      el.className = 'feed-item ' + (item.kind || '');
      el.innerHTML = `<div class="ico">${item.icon}</div><div><div>${esc(item.text)}</div><div class="day">Day ${G.S.day}</div></div>`;
      list.insertBefore(el, list.firstChild);
      while (list.children.length > 60) list.removeChild(list.lastChild);
      // unread marker when the feed is collapsed into the drawer
      const feed = $('.feed');
      if (feed && !document.body.classList.contains('feed-open') && getComputedStyle(feed).display === 'none' && !$('#btnFeed .dot')) { const d = document.createElement('span'); d.className = 'dot'; $('#btnFeed').appendChild(d); }
    },
    rebuildFeed() {
      const list = $('#feedList'); list.innerHTML = '';
      for (const item of [...G.S.eventLog].reverse().slice(-60)) {
        const el = document.createElement('div'); el.className = 'feed-item ' + (item.kind || ''); el.style.animation = 'none';
        el.innerHTML = `<div class="ico">${item.icon}</div><div><div>${esc(item.text)}</div><div class="day">Day ${item.day}</div></div>`;
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
      return [UI.view, UI.detailBiz, UI.rivalsTab, UI.marketMine, S.businesses.map(b => b.id + ':' + b.staff + ':' + Object.values(b.upgrades).join('')).join(','), S.loans.map(l => l.id).join(','),
        S.events.active.map(e => e.id).join(','), Object.values(S.hq).join(''), Object.keys(S.portfolio).join(','), S.competitors.filter(c => c.acquired).length,
        Object.keys(S.unlocked).length, S.quests.map(q => q.tid + (q.done ? 'd' : '')).join(','), S.cash < 0, S.flags.won, Object.keys(S.achievements).length].join('|');
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
        case 'market': v.innerHTML = UI.htmlMarket(); break;
        case 'bank': v.innerHTML = UI.htmlBank(); break;
        case 'hq': v.innerHTML = UI.htmlHQ(); break;
        case 'rivals': v.innerHTML = UI.htmlRivals(); break;
      }
      UI.mountedView = UI.view;
      UI.renderQuests();
      UI.lastChart = 0; UI.sparkDay = -1;
    },
    refresh() {
      UI.refreshTop();
      switch (UI.view) {
        case 'dashboard': UI.refreshDashboard(); break;
        case 'businesses': UI.detailBiz ? UI.refreshBizDetail() : UI.refreshBusinesses(); break;
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
      const cashEl = $('#topCash'); tweenNumber(cashEl, S.cash, fmt); cashEl.classList.toggle('neg', S.cash < 0);
      const p = clamp(S.valuation / D.WIN_VALUE, 0, 1);
      $('#goalFill').style.width = Math.max(0.5, p * 100) + '%';
      setText('#goalPct', `${fmt(S.valuation)} · ${p < 0.001 ? (p * 100).toFixed(3) : (p * 100).toFixed(1)}%`);
      setText('#sideRank', `#${S.rank} of ${G.ranking().length}`);
      setHtml('#sideStreak', S.streak >= 3 ? `🔥 ${S.streak}-day profit streak` : `<span class="muted">Profit streak: ${S.streak}</span>`);
      UI.updateSpeedButtons();
    },

    // ============================================================================
    // DASHBOARD
    // ============================================================================
    htmlDashboard() {
      const S = G.S;
      const stats = [
        ['cash', 'Cash', 'accent-teal'], ['revenue', 'Revenue / day', ''], ['profit', 'Profit / day', 'accent-green'],
        ['debt', 'Debt', 'accent-red'], ['inventory', 'Inventory value', ''], ['value', 'Company value', 'accent-gold'],
      ];
      return `
        ${S.cash < 0 ? `<div class="danger-banner">⚠️ OVERDRAFT — you have ${10 - S.overdraftDays} days to get cash above zero. <button class="btn sm danger" data-action="view" data-view="bank">Go to Bank</button></div>` : ''}
        <div class="view-title"><div><h1>Dashboard</h1><div class="sub">${esc(S.company)} · ${DIFFICULTY[S.difficulty].name} · Share price <b class="mono" id="dashShare"></b></div></div>
          <div class="row"><button class="btn sm" data-action="restockAll">📦 Restock all (${UI.restockDays}d)</button><button class="btn sm" data-action="pricesAll">🏷️ Suggested prices</button></div></div>
        <div class="tip-box" id="tipBox"><span>💡</span><span id="tipText"></span></div>
        <div class="grid cols-6" style="margin-top:14px">
          ${stats.map(([k, label, cls]) => `<div class="card stat-card ${cls}" id="stat-${k}"><div class="label"><span>${label}</span><span class="delta" data-d="${k}"></span></div><div class="value" data-v="${k}">—</div><div class="delta small muted" data-s="${k}"></div><canvas data-spark="${k}"></canvas></div>`).join('')}
        </div>
        <div class="grid cols-2 section">
          <div class="card">
            <div class="row between"><h3>Company valuation</h3><div class="row">
              <div class="tabs" style="margin:0">${[30, 90, 365].map(r => `<button class="${UI.chartRange === r ? 'active' : ''}" data-action="range" data-range="${r}">${r}d</button>`).join('')}<button class="${UI.chartLog ? 'active' : ''}" data-action="logscale">log</button></div></div></div>
            <div class="chart-wrap"><canvas id="chartVal" data-hover="1" height="230"></canvas></div>
            <div class="row between small muted" style="margin-top:6px"><span id="valBreak"></span><span id="sentimentLbl"></span></div>
          </div>
          <div class="card">
            <div class="row between"><h3>Revenue vs profit (30 days)</h3><div class="legend"><span><i style="background:#60a5fa"></i>Revenue</span><span><i style="background:#34d399"></i>Profit</span></div></div>
            <div class="chart-wrap"><canvas id="chartPL" height="230"></canvas></div>
          </div>
        </div>
        <div class="grid cols-3 section">
          <div class="card"><h3>Yesterday's P&amp;L</h3><div id="plBox"></div></div>
          <div class="card"><h3>Market conditions</h3><div id="eventsBox"></div></div>
          <div class="card"><h3>Empire</h3><div id="empireBox"></div></div>
        </div>`;
    },
    refreshDashboard() {
      const S = G.S, h = S.history, n = h.valuation.length;
      const prev = (arr, k = 2) => arr.length >= k ? arr[arr.length - k] : null;
      const vals = { cash: S.cash, revenue: S.lastDay.revenue, profit: S.lastDay.profit, debt: G.totalDebt(), inventory: G.totalInventoryValue(), value: S.valuation };
      const series = { cash: h.cash, revenue: h.revenue, profit: h.profit, debt: h.debt, inventory: null, value: h.valuation };
      const prevs = { cash: prev(h.cash), revenue: prev(h.revenue), profit: prev(h.profit), debt: prev(h.debt), inventory: null, value: prev(h.valuation, 8) };
      for (const k in vals) {
        const el = $(`[data-v="${k}"]`); if (!el) continue;
        tweenNumber(el, vals[k], fmt);
        const d = $(`[data-d="${k}"]`);
        if (d) d.innerHTML = k === 'inventory' ? '' : deltaHtml(vals[k], prevs[k], k === 'debt');
        const s = $(`[data-s="${k}"]`);
        if (s) s.textContent = k === 'value' ? `7-day trend · rank #${S.rank}` : k === 'profit' ? `30-day avg ${fmt(S.ema30)}/day` : k === 'debt' ? `${S.loans.length} loan${S.loans.length === 1 ? '' : 's'} · ${(G.currentRate() * 100).toFixed(2)}%/day` : k === 'inventory' ? `${S.businesses.length} location${S.businesses.length === 1 ? '' : 's'}` : k === 'cash' ? (S.cash < 0 ? `⚠️ overdraft day ${S.overdraftDays}` : `credit available ${fmt(G.availableCredit())}`) : `${S.lastDay.units.toLocaleString()} units sold`;
        const canvas = $(`[data-spark="${k}"]`);
        if (canvas && series[k] && series[k].length > 1 && canvas._day !== S.day) { canvas._day = S.day; Charts.spark(canvas, series[k].slice(-40), k === 'debt' ? '#f87171' : k === 'value' ? '#fbbf24' : '#2dd4bf'); }
      }
      setText('#dashShare', `${fmt(S.sharePrice)} / share`);
      setText('#valBreak', `Net assets ${fmt(S.netAssets)} + goodwill ${fmt(S.goodwill)} (${S.multiple.toFixed(0)}× avg profit)`);
      const sent = S.sentiment;
      setHtml('#sentimentLbl', `Investor sentiment: <b class="${sent >= 1.05 ? 'good' : sent <= 0.95 ? 'bad' : ''}">${sent >= 1.15 ? '🚀 Euphoric' : sent >= 1.05 ? '😊 Optimistic' : sent <= 0.85 ? '😱 Panicked' : sent <= 0.95 ? '😟 Nervous' : '😐 Neutral'}</b>`);
      // P&L
      const L = S.lastDay;
      const rows = [['Revenue', L.revenue, 'good'], ['Cost of goods', -L.cogs], ['Wages', -L.wages], ['Rent', -L.rent], ['Marketing', -L.marketing], ['Interest', -L.interest], ['Spoilage', -(L.spoilage || 0)], ['Subsidiaries', L.subsidiaries || 0, 'good']].filter(r => r[1] !== 0 || r[0] === 'Revenue');
      setHtml('#plBox', rows.map(r => `<div class="pl-row"><span>${r[0]}</span><span class="mono ${r[1] < 0 ? 'muted' : r[2] || ''}">${fmt(r[1])}</span></div>`).join('') + `<div class="pl-row total"><span>Net profit</span><span class="mono ${L.profit >= 0 ? 'good' : 'bad'}">${fmt(L.profit)}</span></div>` + (L.other ? `<div class="pl-row"><span class="muted">One-off cash (events, rewards)</span><span class="mono ${L.other >= 0 ? 'gold' : 'bad'}">${sign(L.other)}${fmt(L.other)}</span></div>` : ''));
      // events
      const ev = S.events.active;
      setHtml('#eventsBox', (ev.length ? ev.map(e => `<div class="chip ${e.kind === 'bad' ? 'bad' : e.kind === 'good' ? 'good' : ''}" style="margin:0 6px 6px 0">${e.icon} ${esc(e.title)} <span class="days">${e.days}d left</span></div>`).join('') : '<div class="muted small">Calm markets. Enjoy it while it lasts.</div>') +
        `<div class="divider"></div><div class="kv"><span>Interest rate</span><span class="v">${(G.currentRate() * 100).toFixed(2)}%/day</span></div><div class="kv"><span>Competition pressure</span><span class="v">${pct(1 - G.competitionFactor('corner', G.activeEffects()))}</span></div><div class="kv"><span>Events seen</span><span class="v">${S.stats.eventsSeen}</span></div>`);
      // empire
      const staff = G.totalStaff();
      setHtml('#empireBox', `<div class="kv"><span>Businesses</span><span class="v">${S.businesses.length}</span></div><div class="kv"><span>Employees</span><span class="v">${staff}</span></div><div class="kv"><span>Subsidiaries</span><span class="v">${S.subsidiaries.length}</span></div><div class="kv"><span>Stock portfolio</span><span class="v">${fmt(G.portfolioValue())}</span></div><div class="kv"><span>Best streak</span><span class="v">${S.stats.bestStreak} days</span></div><div class="kv"><span>Achievements</span><span class="v">${Object.keys(S.achievements).length}/${ACHIEVEMENTS.length}</span></div>
        <div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn sm primary" data-action="view" data-view="businesses">🏬 Manage businesses</button><button class="btn sm" data-action="view" data-view="rivals">⚔️ Rivals</button></div>`);
      UI.refreshTip();
    },
    refreshTip() {
      const S = G.S, el = $('#tipText'); if (!el) return;
      let tip;
      const b0 = S.businesses[0];
      if (S.day < 3 && b0) tip = `Welcome, ${S.company}! Your Corner Store has 2 days of stock. Open <b>Businesses → ${esc(b0.name)}</b> to restock, set prices and hire.`;
      else if (S.businesses.some(b => Object.values(b.stock).every(v => v === 0)) && S.day < 20) tip = 'A store has empty shelves! Restock it or switch on <b>auto-restock</b> so it never runs dry.';
      else if (S.day < 12 && S.stats.loansTaken === 0) tip = 'Growth needs capital. The <b>Bank</b> will lend you money — a second store pays back a loan in a few weeks.';
      else if (S.businesses.length === 1 && S.day > 15) tip = 'Expand! Open a second business from <b>Businesses → Expand your empire</b>. Each store adds profit and company value.';
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
        if (cv) { const data = S.history.valuation.slice(-UI.chartRange); Charts.line(cv, data, { color: '#fbbf24', log: UI.chartLog, startDay: S.day - data.length + 1, height: 230 }); }
        if (cp) { const r = S.history.revenue.slice(-30), p = S.history.profit.slice(-30); Charts.bars(cp, r, p, { startDay: S.day - r.length + 1, height: 230 }); }
      } else if (UI.view === 'market') {
        $$('canvas[data-mspark]').forEach(c => { const m = S.market[c.dataset.mspark]; if (m) Charts.spark(c, m.history.slice(-30), '#60a5fa', 28); });
      } else if (UI.view === 'rivals') {
        $$('canvas[data-rspark]').forEach(c => { const hist = c.dataset.rspark === 'you' ? S.history.valuation : (G._comp(c.dataset.rspark) || {}).history; if (hist) Charts.spark(c, hist.slice(-30), c.dataset.rspark === 'you' ? '#fbbf24' : '#a78bfa', 28); });
      } else if (UI.view === 'businesses' && UI.detailBiz) {
        const c = $('#bizChart'); const b = G.biz(UI.detailBiz);
        if (c && b) Charts.bars(c, b.history.slice(-30), null, { colorA: '#34d399', height: 140, startDay: S.day - Math.min(30, b.history.length) + 1 });
      }
    },

    // ============================================================================
    // BUSINESSES (list + expansion shop)
    // ============================================================================
    htmlBusinesses() {
      const S = G.S;
      return `<div class="view-title"><div><h1>Businesses</h1><div class="sub">${S.businesses.length} location${S.businesses.length === 1 ? '' : 's'} · ${G.totalStaff()} employees</div></div>
        <div class="row"><button class="btn sm" data-action="autoAll">🤖 Auto-restock all</button><button class="btn sm" data-action="restockAll">📦 Restock all (${UI.restockDays}d)</button><button class="btn sm" data-action="pricesAll">🏷️ Suggested prices</button></div></div>
        <div class="grid auto" id="bizGrid">${S.businesses.map(b => UI.htmlBizCard(b)).join('') || '<div class="card empty">You own no businesses. Buy one below before the bank comes knocking.</div>'}</div>
        <div class="section"><div class="view-title"><div><h1 style="font-size:18px">Expand your empire</h1><div class="sub">New business types unlock as your company value grows.</div></div></div>
        <div class="grid auto" id="shopGrid">${TYPE_ORDER.map(t => UI.htmlShopCard(t)).join('')}</div></div>`;
    },
    htmlBizCard(b) {
      const T = BUSINESS_TYPES[b.type];
      return `<div class="card biz-card" data-action="openBiz" data-id="${b.id}" id="bizcard-${b.id}">
        <div class="head"><div class="ico">${T.icon}</div><div><div class="name">${esc(b.name)}</div><div class="type">${T.name}</div></div></div>
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
          ${unlocked ? `<button class="btn sm primary" data-action="buyBiz" data-type="${t}" data-f="buybtn">Open</button>` : `<span class="badge">🔒 Needs ${fmt(T.unlock)} value</span>`}</div>
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
        const st = $('[data-f="staff"]', card); st.textContent = `${b.staff} / ${rec}`; st.className = b.staff < rec ? 'bad' : '';
        const sk = $('[data-f="stock"]', card); sk.textContent = minDays === Infinity ? '—' : minDays < 1 ? `${minDays.toFixed(1)}d ⚠️` : `${minDays.toFixed(1)} days`; sk.className = minDays < 1 ? 'bad' : minDays < 2 ? 'gold' : '';
        const sv = $('[data-f="service"]', card); sv.textContent = pct(b.last.serviceRatio, 0); sv.className = b.last.serviceRatio < 0.85 ? 'bad' : '';
        $('[data-f="rep"]', card).textContent = Math.round(b.rep);
        const rb = $('[data-f="repbar"]', card); rb.style.width = b.rep + '%'; rb.className = 'fill ' + (b.rep >= 70 ? 'green' : b.rep >= 40 ? 'gold' : 'red');
        const warns = [];
        if (b.staff < rec) warns.push('<span class="badge bad">Understaffed</span>');
        if (minDays < 1) warns.push('<span class="badge bad">Low stock</span>');
        if (b.history.length > 5 && profit < 0) warns.push('<span class="badge bad">Losing money</span>');
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
      return `<div class="view-title"><div class="row"><button class="btn sm" data-action="backBiz">← All businesses</button><h1 style="margin-left:8px">${T.icon} <span id="bizName">${esc(b.name)}</span></h1><button class="btn xs ghost" data-action="rename" data-id="${b.id}" title="Rename">✏️</button></div>
        <div class="row"><span class="badge">${T.name}</span><button class="btn sm danger" data-action="sellBiz" data-id="${b.id}">Sell for <span data-f="salevalue"></span></button></div></div>
        <div class="grid cols-3">
          <div class="card"><h3>Reputation</h3><div class="row"><span class="big-num" data-f="rep"></span><span class="muted small" data-f="repnote"></span></div><div class="bar" style="margin-top:6px"><div class="fill" data-f="repbar"></div></div><div class="small muted" style="margin-top:6px">Reputation multiplies foot traffic (×<span data-f="repmult"></span>). Stockouts, understaffing and price gouging hurt it.</div></div>
          <div class="card"><h3>Yesterday</h3><div class="pl-row"><span>Revenue</span><span class="mono good" data-f="rev"></span></div><div class="pl-row"><span>Cost of goods</span><span class="mono muted" data-f="cogs"></span></div><div class="pl-row"><span>Wages</span><span class="mono muted" data-f="wages"></span></div><div class="pl-row"><span>Rent + marketing</span><span class="mono muted" data-f="rentmk"></span></div><div class="pl-row total"><span>Profit</span><span class="mono" data-f="profit"></span></div></div>
          <div class="card"><h3>Profit (30 days)</h3><div class="chart-wrap"><canvas id="bizChart" height="140"></canvas></div></div>
        </div>
        <div class="card section">
          <div class="row between"><h3>Products &amp; pricing</h3><div class="row"><span class="small muted">Buy for:</span><div class="btngroup">${[1, 3, 7].map(d => `<button class="btn xs ${UI.restockDays === d ? 'primary' : ''}" data-action="setRestockDays" data-days="${d}">${d} day${d > 1 ? 's' : ''}</button>`).join('')}</div><button class="btn sm" data-action="buyAllBiz" data-id="${b.id}">📦 Restock all products</button><button class="btn sm" data-action="pricesBiz" data-id="${b.id}">🏷️ Suggested prices</button></div></div>
          ${T.products.map(pid => UI.htmlProductRow(b, pid)).join('')}
        </div>
        <div class="grid cols-2 section">
          <div class="card"><h3>Staff &amp; wages</h3>
            <div class="staff-box">
              <div><div class="muted small">Employees</div><div class="row"><span class="big-num" data-f="staff"></span><span class="muted small">recommended <b data-f="recstaff"></b></span></div>
                <div class="btngroup" style="margin-top:8px"><button class="btn sm" data-action="fire" data-id="${b.id}" data-n="5">−5</button><button class="btn sm" data-action="fire" data-id="${b.id}" data-n="1">−1</button><button class="btn sm primary" data-action="hire" data-id="${b.id}" data-n="1">+1</button><button class="btn sm primary" data-action="hire" data-id="${b.id}" data-n="5">+5</button><button class="btn sm gold" data-action="hireRec" data-id="${b.id}">Auto-fit</button></div>
                <div class="small muted" style="margin-top:6px">Daily wage bill: <b data-f="wagebill"></b> · firing costs 2 days' pay</div></div>
              <div><div class="muted small">Service level <span class="muted">(customers served)</span></div><div class="row"><span class="big-num" data-f="service"></span></div><div class="bar" style="margin-top:6px"><div class="fill" data-f="servicebar"></div></div>
                <div class="small muted" style="margin-top:8px">Capacity <b data-f="capacity"></b> units/day vs demand <b data-f="demandunits"></b></div></div>
            </div>
            <div class="divider"></div>
            <div class="row between"><span>Wage level: <b data-f="wagelbl"></b></span><span data-f="morale"></span></div>
            <input type="range" min="0.6" max="1.6" step="0.1" value="${b.wageMult}" data-input="wage" data-id="${b.id}">
            <div class="small muted">Higher pay = happier, more productive staff (productivity ×<b data-f="prod"></b>).</div>
          </div>
          <div class="card"><h3>Marketing &amp; automation</h3>
            <div class="row between"><span>Marketing budget: <b data-f="mklbl"></b>/day</span><span class="good" data-f="mkboost"></span></div>
            <input type="range" min="0" max="${T.rent * 8}" step="${Math.max(1, Math.round(T.rent / 10))}" value="${b.marketing}" data-input="marketing" data-id="${b.id}">
            <div class="divider"></div>
            <div class="row between" style="margin-bottom:10px"><div><b>Auto-restock</b><div class="small muted">Keeps <input class="input sm" type="number" min="1" max="30" value="${b.stockDays}" data-input="stockDays" data-id="${b.id}" style="width:56px"> days of stock in every product</div></div><div class="toggle ${b.autoRestock ? 'on' : ''}" data-action="toggleAuto" data-id="${b.id}"></div></div>
            <div class="row between"><div><b>Smart pricing</b><div class="small muted">${S.hq.analytics ? 'Re-prices products daily to the suggested price.' : 'Requires the Analytics Suite (HQ Upgrades).'}</div></div><div class="toggle ${b.autoPrice ? 'on' : ''} ${S.hq.analytics ? '' : 'disabled'}" data-action="toggleAutoPrice" data-id="${b.id}"></div></div>
          </div>
        </div>
        <div class="card section"><h3>Upgrades</h3>
          ${Object.keys(UPGRADES).map(uid => { const U = UPGRADES[uid], lvl = b.upgrades[uid], cost = G.upgradeCost(b, uid); return `<div class="upgrade-row ${cost === null ? 'maxed' : ''}"><div class="ico">${U.icon}</div><div class="info"><b>${U.name} ${levelDots(lvl, U.max)}</b><span>${U.desc}</span></div>${cost === null ? '<span class="badge gold">MAX</span>' : `<button class="btn sm ${S.cash >= cost ? 'primary' : ''}" data-action="upgrade" data-id="${b.id}" data-uid="${uid}" data-f="upg-${uid}">${fmt(cost)}</button>`}</div>`; }).join('')}
        </div>`;
    },
    htmlProductRow(b, pid) {
      const p = PRODUCTS[pid];
      return `<div class="prod-row" id="prow-${pid}">
        <div class="pcell"><div class="lbl">Product</div><div class="pname"><span class="ico">${p.icon}</span><span>${p.name}</span></div><div class="small muted" data-f="sold"></div>${p.perishable ? '<div class="small muted">🧊 perishable: loses 3%/day</div>' : ''}</div>
        <div class="pcell"><div class="lbl">Stock</div><b class="mono" data-f="stock"></b> <span class="small muted" data-f="cap"></span><div class="bar stockbar"><div class="fill" data-f="stockbar"></div></div><div class="small muted" data-f="days"></div></div>
        <div class="pcell"><div class="lbl">Wholesale</div><b class="mono" data-f="cost"></b><div class="small muted" data-f="trend"></div></div>
        <div class="pcell"><div class="lbl">Your price</div><div class="price-ctl"><button class="btn xs" data-action="priceStep" data-id="${b.id}" data-pid="${pid}" data-dir="-1">−</button><input class="input sm" type="number" step="any" min="0.01" value="${b.prices[pid]}" data-input="price" data-id="${b.id}" data-pid="${pid}"><button class="btn xs" data-action="priceStep" data-id="${b.id}" data-pid="${pid}" data-dir="1">+</button></div><div class="small" data-f="pricenote"></div></div>
        <div class="pcell"><div class="lbl">Demand</div><div data-f="demand"></div><div class="small muted" data-f="expect"></div></div>
        <div class="pcell"><div class="lbl">Buy stock</div><div class="btngroup"><button class="btn xs primary" data-action="buy" data-id="${b.id}" data-pid="${pid}" data-f="buybtn">Buy</button><button class="btn xs" data-action="buyMax" data-id="${b.id}" data-pid="${pid}">Max</button></div></div>
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
      setText('[data-f="rev"]', fmt(L.revenue)); setText('[data-f="cogs"]', fmt(-L.cogs)); setText('[data-f="wages"]', fmt(-L.wages)); setText('[data-f="rentmk"]', fmt(-(L.rent + L.marketing)));
      const pr = $('[data-f="profit"]'); pr.textContent = fmt(L.profit); pr.className = 'mono ' + (L.profit >= 0 ? 'good' : 'bad');
      // products
      let totalExp = 0;
      for (const pid of T.products) {
        const row = $(`#prow-${pid}`); if (!row) continue;
        const cap = G.capacity(b, pid), exp = G.expectedDemand(b, pid, b.prices[pid], fx); totalExp += exp;
        const days = b.stock[pid] / Math.max(exp, 0.01);
        setText('[data-f="stock"]', b.stock[pid].toLocaleString(), row); setText('[data-f="cap"]', `/ ${cap.toLocaleString()}`, row);
        const sb = $('[data-f="stockbar"]', row); sb.style.width = (b.stock[pid] / cap * 100) + '%'; sb.className = 'fill ' + (days < 1 ? 'red' : days < 2 ? 'gold' : 'green');
        const dEl = $('[data-f="days"]', row); dEl.textContent = b.stock[pid] === 0 ? 'OUT OF STOCK' : `≈ ${days.toFixed(1)} days left`; dEl.className = 'small ' + (b.stock[pid] === 0 ? 'bad' : 'muted');
        setText('[data-f="sold"]', `sold ${L.sold[pid] || 0} yesterday`, row);
        const cost = G.buyCost(pid), m = S.market[pid], h = m.history, prev = h.length > 7 ? h[h.length - 8] : h[0];
        setText('[data-f="cost"]', fmt(cost), row);
        const ch = prev ? (m.cost - prev) / prev : 0;
        const tr = $('[data-f="trend"]', row); tr.innerHTML = `${ch > 0.02 ? '<span class="bad">▲</span>' : ch < -0.02 ? '<span class="good">▼</span>' : '→'} ${Math.abs(ch * 100).toFixed(0)}% / 7d`;
        const inp = $('[data-input="price"]', row); if (document.activeElement !== inp && +inp.value !== b.prices[pid]) inp.value = b.prices[pid];
        const ratio = b.prices[pid] / G.fairPrice(pid);
        const margin = b.prices[pid] - b.avgCost[pid];
        setHtml('[data-f="pricenote"]', `${priceBadge(ratio)}<div class="muted">suggested ${fmt(G.suggestedPrice(pid))} · margin <span class="${margin >= 0 ? 'good' : 'bad'}">${fmt(margin)}</span></div>`, row);
        setHtml('[data-f="demand"]', demandBadge(G.demandMult(b, pid, fx)), row);
        setText('[data-f="expect"]', `≈ ${exp < 10 ? exp.toFixed(1) : Math.round(exp)} / day at this price`, row);
        const qty = Math.max(1, Math.ceil(exp * UI.restockDays));
        const btn = $('[data-f="buybtn"]', row); const q = Math.min(qty, cap - b.stock[pid]);
        btn.textContent = q <= 0 ? 'Full' : `Buy ${q} (${fmt(q * cost)})`; btn.disabled = q <= 0 || S.cash < cost;
      }
      G._fx = null;
      // staff
      const rec = G.recommendedStaff(b), capU = G.throughput(b, fx);
      setText('[data-f="staff"]', b.staff); setText('[data-f="recstaff"]', rec);
      setText('[data-f="wagebill"]', fmt(b.staff * G.dailyWage(b, fx)));
      const sv = L.serviceRatio; const svEl = $('[data-f="service"]'); svEl.textContent = pct(sv, 0); svEl.className = 'big-num ' + (sv < 0.85 ? 'bad' : sv < 0.97 ? 'gold' : 'good');
      const svb = $('[data-f="servicebar"]'); svb.style.width = (sv * 100) + '%'; svb.className = 'fill ' + (sv < 0.85 ? 'red' : sv < 0.97 ? 'gold' : 'green');
      setText('[data-f="capacity"]', Math.round(capU).toLocaleString()); setText('[data-f="demandunits"]', Math.round(totalExp).toLocaleString());
      setText('[data-f="wagelbl"]', `${Math.round(b.wageMult * 100)}% of market (${fmt(G.dailyWage(b, fx))}/day)`);
      setText('[data-f="morale"]', moraleLabel(b.wageMult)); setText('[data-f="prod"]', G.productivity(b, fx).toFixed(2));
      setText('[data-f="mklbl"]', fmt(b.marketing)); setText('[data-f="mkboost"]', `+${((G.marketingFactor(b) - 1) * 100).toFixed(0)}% traffic`);
      for (const uid in UPGRADES) { const btn = $(`[data-f="upg-${uid}"]`); if (btn) { const c = G.upgradeCost(b, uid); btn.disabled = c === null || S.cash < c; btn.classList.toggle('primary', c !== null && S.cash >= c); } }
    },

    // ============================================================================
    // MARKET
    // ============================================================================
    htmlMarket() {
      const S = G.S;
      const mine = new Set(S.businesses.flatMap(b => BUSINESS_TYPES[b.type].products));
      const pids = Object.keys(PRODUCTS).filter(p => !UI.marketMine || mine.has(p));
      const soldBy = pid => TYPE_ORDER.filter(t => BUSINESS_TYPES[t].products.includes(pid)).map(t => BUSINESS_TYPES[t].icon).join(' ');
      return `<div class="view-title"><div><h1>Market</h1><div class="sub">Wholesale prices move with supply and demand. Big purchases push prices up; they recover over time.</div></div>
        <div class="row"><div class="tabs" style="margin:0"><button class="${UI.marketMine ? 'active' : ''}" data-action="marketMine" data-v="1">My products</button><button class="${!UI.marketMine ? 'active' : ''}" data-action="marketMine" data-v="0">All products</button></div>
        <div class="btngroup">${[1, 3, 7].map(d => `<button class="btn xs ${UI.restockDays === d ? 'primary' : ''}" data-action="setRestockDays" data-days="${d}">${d}d</button>`).join('')}</div><button class="btn sm primary" data-action="restockAll">📦 Restock all businesses</button></div></div>
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
        const c = $('[data-f="ch"]', row); c.innerHTML = `<span class="${ch > 0.02 ? 'bad' : ch < -0.02 ? 'good' : 'muted'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch * 100).toFixed(1)}%</span>`;
        const dm = m.demand * fx.demandAll * (fx.demandCat[PRODUCTS[pid].cat] || 1) * (fx.demandProduct[pid] || 1);
        setHtml('[data-f="demand"]', demandBadge(dm), row);
        const sp = m.supply;
        setHtml('[data-f="supply"]', sp < 0.6 ? '<span class="badge bad">Scarce</span>' : sp < 0.85 ? '<span class="badge gold">Tight</span>' : sp > 1.15 ? '<span class="badge good">Glut</span>' : '<span class="badge">Normal</span>', row);
      }
      const ev = S.events.active;
      setHtml('#marketEvents', ev.length ? ev.map(e => `<div class="chip ${e.kind === 'bad' ? 'bad' : e.kind === 'good' ? 'good' : ''}" style="margin:0 6px 6px 0">${e.icon} ${esc(e.title)} <span class="days">${e.days}d</span></div>`).join('') : '<span class="muted">No active events.</span>');
    },

    // ============================================================================
    // BANK
    // ============================================================================
    htmlBank() {
      const S = G.S;
      return `<div class="view-title"><div><h1>Bank</h1><div class="sub">Credit grows with your net assets. Interest is charged daily and rises the more you borrow.</div></div></div>
        <div class="grid cols-3">
          <div class="card"><h3>Credit line</h3><div class="big-num teal" data-f="avail"></div><div class="small muted">available of <b data-f="limit"></b></div><div class="bar" style="margin-top:8px"><div class="fill gold" data-f="utilbar"></div></div><div class="small muted" style="margin-top:6px">Utilization <b data-f="util"></b> · rate <b data-f="rate"></b>/day</div></div>
          <div class="card"><h3>Take a loan</h3><div class="row"><input class="input" type="number" min="100" step="100" id="loanAmt" placeholder="Amount" style="flex:1"><button class="btn primary" data-action="takeLoan">Borrow</button></div>
            <div class="btngroup" style="margin-top:8px">${[0.25, 0.5, 1].map(f => `<button class="btn xs" data-action="loanPreset" data-f="${f}">${f * 100}%</button>`).join('')}</div>
            <div class="small muted" style="margin-top:8px">Daily cost at current rate: <b data-f="dailycost"></b> per ${fmt(10000)} borrowed. Max ${5} loans.</div></div>
          <div class="card"><h3>Debt</h3><div class="big-num" data-f="debt"></div><div class="small muted">interest paid yesterday <b data-f="interest"></b></div><div class="small" style="margin-top:8px" data-f="danger"></div></div>
        </div>
        <div class="card section"><h3>Loans</h3>
          ${S.loans.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th class="num">Balance</th><th class="num">Rate</th><th>Taken</th><th class="num">Interest paid</th><th></th></tr></thead><tbody>${S.loans.map(l => `<tr id="loan-${l.id}"><td>${l.id}</td><td class="num" data-f="bal"></td><td class="num" data-f="rate"></td><td>Day ${l.day}</td><td class="num" data-f="paid"></td><td class="right"><div class="btngroup"><button class="btn xs" data-action="repay" data-id="${l.id}" data-frac="0.25">Repay 25%</button><button class="btn xs primary" data-action="repay" data-id="${l.id}" data-frac="1">Repay all</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No loans. Debt-free and dangerous.</div>'}
        </div>
        <div class="card section"><h3>Emergency cash</h3><div class="row wrap"><button class="btn sm danger" data-action="liquidateAll">Sell ALL inventory (50% of cost)</button><span class="small muted">Raises <b data-f="liq"></b>. Businesses can be sold from their detail page.</span></div></div>`;
    },
    refreshBank() {
      const S = G.S;
      const limit = G.creditLimit(), debt = G.totalDebt(), avail = G.availableCredit();
      setText('[data-f="avail"]', fmt(avail)); setText('[data-f="limit"]', fmt(limit));
      const util = limit > 0 ? debt / limit : 0;
      const ub = $('[data-f="utilbar"]'); if (ub) ub.style.width = clamp(util * 100, 0, 100) + '%';
      setText('[data-f="util"]', pct(util, 0)); setText('[data-f="rate"]', (G.currentRate() * 100).toFixed(2) + '%');
      setText('[data-f="dailycost"]', fmt(10000 * G.currentRate()));
      setText('[data-f="debt"]', fmt(debt)); setText('[data-f="interest"]', fmt(S.lastDay.interest));
      setHtml('[data-f="danger"]', S.cash < 0 ? `<span class="bad">⚠️ Overdraft day ${S.overdraftDays}/10 — 1% daily penalty on the negative balance.</span>` : '<span class="good">Accounts in good standing.</span>');
      const fx = G.activeEffects();
      for (const l of S.loans) { const row = $(`#loan-${l.id}`); if (!row) continue; setText('[data-f="bal"]', fmt(l.amount), row); setText('[data-f="rate"]', (l.rate * fx.rate * 100).toFixed(2) + '%/day', row); setText('[data-f="paid"]', fmt(l.paidInterest), row); }
      setText('[data-f="liq"]', fmt(G.totalInventoryValue() * 0.5));
    },

    // ============================================================================
    // HQ UPGRADES
    // ============================================================================
    htmlHQ() {
      const S = G.S;
      return `<div class="view-title"><div><h1>Headquarters</h1><div class="sub">Company-wide upgrades that boost every business you own.</div></div></div>
        <div class="grid auto">${Object.keys(HQ_UPGRADES).map(id => { const Hq = HQ_UPGRADES[id], lvl = S.hq[id], cost = G.hqCost(id); return `<div class="card upgrade-card ${cost === null ? 'maxed' : ''}" id="hq-${id}"><div class="row"><span style="font-size:30px">${Hq.icon}</span><div><b>${Hq.name}</b><div class="small muted">Level ${lvl}/${Hq.max}</div></div></div><div class="small" style="margin:8px 0">${Hq.desc}</div>${levelDots(lvl, Hq.max)}<div style="margin-top:10px">${cost === null ? '<span class="badge gold">MAX LEVEL</span>' : `<button class="btn sm primary block" data-action="hq" data-id="${id}" data-f="btn">Upgrade · ${fmt(cost)}</button>`}</div></div>`; }).join('')}</div>
        <div class="grid cols-2 section">
          <div class="card"><h3>Subsidiaries</h3>${S.subsidiaries.length ? S.subsidiaries.map(s => `<div class="kv"><span>${s.icon} ${esc(s.name)}</span><span class="v good">+${fmt(s.income)}/day</span></div>`).join('') : '<div class="muted small">Acquire rivals from the Rivals tab to earn passive income.</div>'}</div>
          <div class="card"><h3>Company stats</h3><div id="hqStats"></div></div>
        </div>`;
    },
    refreshHQ() {
      const S = G.S;
      for (const id in HQ_UPGRADES) { const btn = $(`#hq-${id} [data-f="btn"]`); if (btn) { const c = G.hqCost(id); btn.disabled = c === null || S.cash < c; } }
      setHtml('#hqStats', `<div class="kv"><span>Total revenue</span><span class="v">${fmt(S.stats.totalRevenue)}</span></div><div class="kv"><span>Total profit</span><span class="v">${fmt(S.stats.totalProfit)}</span></div><div class="kv"><span>Units sold</span><span class="v">${S.stats.unitsSold.toLocaleString()}</span></div><div class="kv"><span>Peak value</span><span class="v">${fmt(S.stats.peakValue)}</span></div><div class="kv"><span>Biggest single sale</span><span class="v">${fmt(S.stats.biggestSale)}</span></div><div class="kv"><span>Trading profit</span><span class="v ${S.stats.tradingProfit >= 0 ? 'good' : 'bad'}">${fmt(S.stats.tradingProfit)}</span></div><div class="kv"><span>Quests completed</span><span class="v">${S.stats.questsDone}</span></div>`);
    },

    // ============================================================================
    // RIVALS & STOCKS
    // ============================================================================
    htmlRivals() {
      const S = G.S;
      const rows = G.ranking();
      const lb = `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Company</th><th class="num">Value</th><th class="num">7d</th><th>Trend</th><th>Focus</th><th></th></tr></thead><tbody>
        ${rows.map(r => { const def = r.you ? null : COMPETITORS.find(c => c.id === r.id); return `<tr class="${r.you ? 'you' : ''}" id="rrow-${r.id}"><td><b data-f="rank"></b></td><td>${r.icon} <b>${esc(r.name)}</b>${r.you ? ' <span class="badge teal">YOU</span>' : ''}</td><td class="num" data-f="val"></td><td class="num" data-f="ch"></td><td style="width:110px"><canvas data-rspark="${r.id}" style="width:100px;height:28px"></canvas></td><td class="small muted">${def ? (def.types[0] === '*' ? 'Everything' : def.types.map(t => BUSINESS_TYPES[t].icon).join(' ')) : '—'}</td><td class="right">${def ? `<button class="btn xs gold" data-action="acquire" data-id="${r.id}" data-f="acq"></button>` : ''}</td></tr>`; }).join('')}
        ${S.subsidiaries.map(s => `<tr><td class="muted">—</td><td class="muted">${s.icon} ${esc(s.name)} <span class="badge good">Acquired</span></td><td class="num muted">${fmt(s.value)}</td><td></td><td></td><td></td><td></td></tr>`).join('')}
        </tbody></table></div><div class="small muted" style="margin-top:8px">Acquire a rival when your value is 1.5× theirs and you can pay 125% of their value in cash. Acquisitions become subsidiaries paying 0.4%/day.</div></div>`;
      const stocks = `<div class="grid cols-3"><div class="card"><h3>Portfolio value</h3><div class="big-num gold" data-f="pfval"></div><div class="small muted">unrealized <b data-f="pfpl"></b> · realized <b data-f="realized"></b></div></div><div class="card"><h3>Cash</h3><div class="big-num" data-f="cash"></div><div class="small muted">0.5% fee per trade</div></div><div class="card"><h3>Sentiment</h3><div class="big-num" data-f="sent"></div><div class="small muted">Rival stocks follow market mood. Crashes are buying opportunities.</div></div></div>
        <div class="card section"><div class="table-wrap"><table class="table"><thead><tr><th>Company</th><th class="num">Share price</th><th class="num">7d</th><th class="num">You own</th><th class="num">P&amp;L</th><th>Trade</th></tr></thead><tbody>
        ${COMPETITORS.map((def, i) => { const c = S.competitors[i]; if (c.acquired) return ''; return `<tr id="srow-${def.id}"><td>${def.icon} <b>${def.name}</b></td><td class="num" data-f="price"></td><td class="num" data-f="ch"></td><td class="num" data-f="own"></td><td class="num" data-f="pl"></td><td><div class="row"><input class="input sm" type="number" min="10" step="100" placeholder="$" data-stockamt="${def.id}"><button class="btn xs primary" data-action="buyStock" data-id="${def.id}">Buy</button><button class="btn xs" data-action="sellStock" data-id="${def.id}" data-frac="0.5">Sell ½</button><button class="btn xs" data-action="sellStock" data-id="${def.id}" data-frac="1">Sell all</button></div></td></tr>`; }).join('')}
        </tbody></table></div></div>`;
      return `<div class="view-title"><div><h1>Rivals &amp; Stocks</h1><div class="sub">Eight AI companies compete for your customers. Beat them, buy their stock, or buy them outright.</div></div>
        <div class="tabs" style="margin:0"><button class="${UI.rivalsTab === 'leaderboard' ? 'active' : ''}" data-action="rivalsTab" data-tab="leaderboard">🏆 Leaderboard</button><button class="${UI.rivalsTab === 'stocks' ? 'active' : ''}" data-action="rivalsTab" data-tab="stocks">📈 Stock market</button></div></div>
        ${UI.rivalsTab === 'leaderboard' ? lb : stocks}`;
    },
    refreshRivals() {
      const S = G.S;
      if (UI.rivalsTab === 'leaderboard') {
        const rows = G.ranking();
        for (const r of rows) {
          const row = $(`#rrow-${r.id}`); if (!row) continue;
          setText('[data-f="rank"]', r.rank === 1 ? '👑 1' : String(r.rank), row);
          setText('[data-f="val"]', fmt(r.value), row);
          const hist = r.you ? S.history.valuation : r.hist; const prev = hist && hist.length > 7 ? hist[hist.length - 8] : (hist ? hist[0] : null);
          setHtml('[data-f="ch"]', deltaHtml(r.value, prev), row);
          const btn = $('[data-f="acq"]', row);
          if (btn) { const can = G.canAcquire(r.id); btn.disabled = !can; btn.textContent = can ? `Acquire · ${fmt(G.acquisitionPrice(r.id))}` : `Acquire (${fmt(G.acquisitionPrice(r.id))})`; btn.classList.toggle('glow', can); }
        }
      } else {
        let pfCost = 0; const pfVal = G.portfolioValue();
        for (const cid in S.portfolio) pfCost += S.portfolio[cid].cost;
        setText('[data-f="pfval"]', fmt(pfVal));
        const pl = pfVal - pfCost; const plEl = $('[data-f="pfpl"]'); if (plEl) { plEl.textContent = `${sign(pl)}${fmt(pl)}`; plEl.className = pl >= 0 ? 'good' : 'bad'; }
        const rl = $('[data-f="realized"]'); if (rl) { rl.textContent = `${sign(S.stats.tradingProfit)}${fmt(S.stats.tradingProfit)}`; rl.className = S.stats.tradingProfit >= 0 ? 'good' : 'bad'; }
        setText('[data-f="cash"]', fmt(S.cash));
        setText('[data-f="sent"]', S.sentiment >= 1.15 ? '🚀 Euphoric' : S.sentiment >= 1.05 ? '😊 Optimistic' : S.sentiment <= 0.85 ? '😱 Panicked' : S.sentiment <= 0.95 ? '😟 Nervous' : '😐 Neutral');
        for (let i = 0; i < COMPETITORS.length; i++) {
          const def = COMPETITORS[i], c = S.competitors[i]; const row = $(`#srow-${def.id}`); if (!row) continue;
          const price = c.value / D.SHARES; setText('[data-f="price"]', fmt(price), row);
          const prev = c.history.length > 7 ? c.history[c.history.length - 8] : c.history[0]; setHtml('[data-f="ch"]', deltaHtml(c.value, prev), row);
          const pos = S.portfolio[def.id];
          setText('[data-f="own"]', pos ? `${Math.round(pos.shares).toLocaleString()} sh · ${fmt(pos.shares * price)}` : '—', row);
          const pl2 = pos ? pos.shares * price - pos.cost : 0; const plE = $('[data-f="pl"]', row); plE.textContent = pos ? `${sign(pl2)}${fmt(pl2)}` : '—'; plE.className = 'num ' + (pl2 >= 0 ? 'good' : 'bad');
        }
      }
    },

    // ============================================================================
    // QUESTS (feed panel)
    // ============================================================================
    renderQuests() {
      const S = G.S, box = $('#questList'); if (!box) return;
      const html = S.quests.map(q => { const p = clamp(q.progress / q.target, 0, 1); const isMoney = ['earn_cash', 'value', 'cash'].includes(q.tid); return `<div class="quest ${q.done ? 'done' : ''}"><div class="row between"><span>${q.done ? '✅ ' : ''}${esc(q.text)}</span><span class="reward">+${fmt(q.reward)}</span></div><div class="qbar"><div class="fill" style="width:${p * 100}%"></div></div><div class="small muted">${isMoney ? fmt(Math.max(0, q.progress)) : Math.floor(Math.max(0, q.progress)).toLocaleString()} / ${isMoney ? fmt(q.target) : q.target.toLocaleString()}</div></div>`; }).join('');
      if (box.innerHTML !== html) box.innerHTML = html;
    },

    // ============================================================================
    // ACTIONS (delegated)
    // ============================================================================
    onClick(e) {
      const el = e.target.closest('[data-action]'); if (!el) return;
      const S = G.S, a = el.dataset.action, id = +el.dataset.id;
      const flash = (ok, msg) => { if (!ok) { toast({ icon: '🚫', title: msg || 'Cannot do that', kind: 'bad', ttl: 2500 }); Sound.play('bad'); } };
      switch (a) {
        case 'view': UI.showView(el.dataset.view); return;
        case 'openBiz': Sound.play('click'); UI.openBusiness(id); return;
        case 'backBiz': Sound.play('click'); UI.detailBiz = null; UI.render(true); return;
        case 'range': UI.chartRange = +el.dataset.range; UI.render(true); return;
        case 'logscale': UI.chartLog = !UI.chartLog; UI.render(true); return;
        case 'marketMine': UI.marketMine = el.dataset.v === '1'; UI.render(true); return;
        case 'rivalsTab': UI.rivalsTab = el.dataset.tab; UI.render(true); return;
        case 'setRestockDays': UI.restockDays = +el.dataset.days; UI.render(true); return;
        case 'buyBiz': { const r = G.buyBusiness(el.dataset.type); flash(r.ok, r.msg); if (r.ok) floatAt(el, `-${fmt(r.biz.paid)}`, 'bad'); break; }
        case 'sellBiz': { const b = G.biz(id); if (!b) return; Modal.open({ title: `Sell ${b.name}?`, icon: '🏷️', body: `<p>You will receive <b class="gold">${fmt(G.bizSaleValue(b))}</b> (55% of purchase price, 40% of upgrades, 50% of inventory). This cannot be undone.</p>`, actions: [{ label: 'Keep it', cls: '' }, { label: 'Sell', cls: 'danger', fn: () => { G.sellBusiness(id); UI.detailBiz = null; UI.render(true); } }] }); return; }
        case 'rename': { const b = G.biz(id); const name = prompt('Rename business:', b.name); if (name) { G.renameBusiness(id, name); } break; }
        case 'buy': case 'buyMax': { const b = G.biz(id), pid = el.dataset.pid; if (!b) return; const exp = G.expectedDemand(b, pid); const qty = a === 'buyMax' ? 1e12 : Math.max(1, Math.ceil(exp * UI.restockDays)); const r = G.buyInventory(id, pid, qty); flash(r.ok, r.msg); if (r.ok) { Sound.play('buy'); floatAt(el, `-${fmt(r.cost)}`, 'bad'); } break; }
        case 'buyAllBiz': { const b = G.biz(id); let spent = 0; for (const pid of BUSINESS_TYPES[b.type].products) { const r = G.buyInventory(id, pid, Math.ceil(G.expectedDemand(b, pid) * UI.restockDays), true); if (r.ok) spent += r.cost; } if (spent) { Sound.play('buy'); floatAt(el, `-${fmt(spent)}`, 'bad'); } else flash(false, 'Nothing bought — storage full or no cash.'); break; }
        case 'restockAll': { let spent = 0; for (const b of S.businesses) for (const pid of BUSINESS_TYPES[b.type].products) { const r = G.buyInventory(b.id, pid, Math.ceil(G.expectedDemand(b, pid) * UI.restockDays), true); if (r.ok) spent += r.cost; } if (spent) { Sound.play('buy'); toast({ icon: '📦', title: `Restocked everything for ${fmt(spent)}`, ttl: 3000 }); } else flash(false, 'Nothing to restock (storage full or no cash).'); break; }
        case 'autoAll': { const on = !S.businesses.every(b => b.autoRestock); for (const b of S.businesses) G.setAutoRestock(b.id, on, UI.restockDays + 1); toast({ icon: '🤖', title: on ? 'Auto-restock enabled everywhere' : 'Auto-restock disabled', ttl: 2500 }); Sound.play('click'); break; }
        case 'pricesAll': for (const b of S.businesses) G.applySuggestedPrices(b.id); toast({ icon: '🏷️', title: 'Prices set to suggested levels', ttl: 2500 }); Sound.play('click'); break;
        case 'pricesBiz': G.applySuggestedPrices(id); Sound.play('click'); break;
        case 'priceStep': { const b = G.biz(id), pid = el.dataset.pid; const step = Math.max(0.05, G.fairPrice(pid) * 0.05); G.setPrice(id, pid, b.prices[pid] + step * +el.dataset.dir); Sound.play('click'); break; }
        case 'hire': G.hire(id, +el.dataset.n); Sound.play('click'); break;
        case 'fire': { const r = G.fire(id, +el.dataset.n); flash(r.ok, r.msg); if (r.ok) floatAt(el, `-${fmt(r.severance)} severance`, 'bad'); break; }
        case 'hireRec': { const b = G.biz(id); const rec = G.recommendedStaff(b); if (rec > b.staff) G.hire(id, rec - b.staff); else if (rec < b.staff) G.fire(id, b.staff - rec); Sound.play('click'); break; }
        case 'toggleAuto': { const b = G.biz(id); G.setAutoRestock(id, !b.autoRestock); Sound.play('click'); break; }
        case 'toggleAutoPrice': { const b = G.biz(id); if (!S.hq.analytics) { flash(false, 'Buy the Analytics Suite at HQ first.'); return; } G.setAutoPrice(id, !b.autoPrice); Sound.play('click'); break; }
        case 'upgrade': { const b = G.biz(id); const cost = G.upgradeCost(b, el.dataset.uid); const r = G.buyUpgrade(id, el.dataset.uid); flash(r.ok, r.msg); if (r.ok) { floatAt(el, `-${fmt(cost)}`, 'bad'); toast({ icon: UPGRADES[el.dataset.uid].icon, title: `${UPGRADES[el.dataset.uid].name} Lv.${b.upgrades[el.dataset.uid]} at ${b.name}`, kind: 'good', ttl: 3000 }); } break; }
        case 'hq': { const r = G.buyHqUpgrade(el.dataset.id); flash(r.ok, r.msg); break; }
        case 'takeLoan': { const amt = +$('#loanAmt').value; const r = G.takeLoan(amt); flash(r.ok, r.msg); if (r.ok) { floatAt(el, `+${fmt(amt)}`, 'gold'); toast({ icon: '🏦', title: `Loan approved: ${fmt(amt)}`, kind: 'good', ttl: 3000 }); } break; }
        case 'loanPreset': $('#loanAmt').value = Math.floor(G.availableCredit() * +el.dataset.f); return;
        case 'repay': { const loan = S.loans.find(l => l.id === id); if (!loan) return; const r = G.repayLoan(id, Math.ceil(loan.amount * +el.dataset.frac)); flash(r.ok, r.msg); if (r.ok) Sound.play('cash'); break; }
        case 'liquidateAll': { Modal.open({ title: 'Sell all inventory?', icon: '🧯', body: `<p>Every unit in every store will be sold at half its cost, raising about <b class="gold">${fmt(G.totalInventoryValue() * 0.5)}</b>. Your shelves will be empty tomorrow.</p>`, actions: [{ label: 'Cancel' }, { label: 'Sell everything', cls: 'danger', fn: () => { let got = 0; for (const b of S.businesses) for (const pid in b.stock) { const r = G.sellInventory(b.id, pid, b.stock[pid]); if (r.ok) got += r.value; } toast({ icon: '🧯', title: `Liquidated inventory for ${fmt(got)}`, ttl: 4000 }); UI.render(true); } }] }); return; }
        case 'buyStock': { const inp = $(`[data-stockamt="${el.dataset.id}"]`); const r = G.buyShares(el.dataset.id, +inp.value || 0); flash(r.ok, r.msg); if (r.ok) { Sound.play('buy'); inp.value = ''; } break; }
        case 'sellStock': { const pos = S.portfolio[el.dataset.id]; if (!pos) { flash(false, 'You own no shares.'); return; } const r = G.sellShares(el.dataset.id, pos.shares * +el.dataset.frac); flash(r.ok, r.msg); if (r.ok) { Sound.play('cash'); floatAt(el, `${sign(r.profit)}${fmt(r.profit)}`, r.profit >= 0 ? 'good' : 'bad'); } break; }
        case 'acquire': { const def = COMPETITORS.find(c => c.id === el.dataset.id); Modal.open({ title: `Acquire ${def.name}?`, icon: def.icon, body: `<p>Pay <b class="gold">${fmt(G.acquisitionPrice(def.id))}</b> in cash to absorb ${def.name}. They stop competing with you and become a subsidiary paying <b>${fmt(G._comp(def.id).value * 0.004)}/day</b>.</p>`, actions: [{ label: 'Not yet' }, { label: 'Sign the deal', cls: 'gold', fn: () => { const r = G.acquireCompetitor(def.id); flash(r.ok, r.msg); UI.render(true); } }] }); return; }
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
        actions: p.def.choices.map((c, i) => ({ label: G._fill(c.label, p.param), cls: i === 0 ? 'primary' : '', fn: () => { G.resolveChoice(i); UI.render(true); } })),
        onClose: () => { if (G.S.events.pending) G.resolveChoice(p.def.choices.length - 1); H.pause(false); } });
      m._locked = true;
    },
    showHelp() {
      Modal.open({ title: 'How to play', icon: '📖', wide: true, body: `
        <ul class="help-list">
          <li><b>Goal:</b> grow your company value from ~$1,000 to <b>$1,000,000,000</b>. Value = net assets + goodwill (a multiple of your average daily profit, boosted by growth and investor sentiment).</li>
          <li><b>Businesses:</b> each store sells 4 products. Buy inventory at wholesale, set retail prices, hire enough staff to serve everyone. Empty shelves and long queues wreck your reputation, and reputation multiplies traffic.</li>
          <li><b>Prices:</b> the suggested price sits just above the fair price. Go higher for fatter margins but fewer customers; go lower to win volume and reputation.</li>
          <li><b>Market:</b> wholesale prices move with supply and demand. Bulk buying pushes them up. Events (heatwaves, recessions, viral trends…) change demand and costs for days at a time.</li>
          <li><b>Bank:</b> loans charge daily interest. Cash below zero triggers an overdraft: 10 days to recover or you go <b>bankrupt</b>.</li>
          <li><b>Expand:</b> new business types unlock as your value grows. Each extra copy of the same type costs more and shares customers.</li>
          <li><b>Upgrades:</b> per-business upgrades (storage, renovation, automation…) and HQ upgrades (logistics, marketing, investor relations…).</li>
          <li><b>Rivals:</b> eight AI companies compete for customers. Overtake them on the leaderboard, trade their stock, or acquire them outright.</li>
          <li><b>Quests &amp; achievements</b> pay cash rewards. Keep an eye on the feed.</li>
          <li><b>Keys:</b> <b>Space</b> pause · <b>1-4</b> speed · <b>D B M K H R</b> switch tabs · <b>Esc</b> close.</li>
        </ul>`, actions: [{ label: 'Got it', cls: 'primary' }] });
    },
    showAchievements() {
      const S = G.S;
      Modal.open({ title: `Achievements (${Object.keys(S.achievements).length}/${ACHIEVEMENTS.length})`, icon: '🏅', wide: true, body: `<div class="ach-grid">${ACHIEVEMENTS.map(a => { const got = S.achievements[a.id]; return `<div class="ach ${got ? (S.day - got < 3 ? 'new' : '') : 'locked'}"><div class="ico">${a.icon}</div><b>${a.name}</b><span>${a.desc}</span>${a.bonus ? `<span class="gold">+${fmt(a.bonus)}</span>` : ''}${got ? `<span>Day ${got}</span>` : ''}</div>`; }).join('')}</div>`, actions: [{ label: 'Close', cls: 'primary' }] });
    },
    showMenu() {
      const wasPaused = H.isPaused(); H.pause(true);
      Modal.open({ title: 'Menu', icon: '☰', body: `<p class="muted small">Progress autosaves every 5 days and whenever you leave the page.</p>`, actions: [
        { label: '▶ Resume', cls: 'primary', fn: () => { if (!wasPaused) H.pause(false); } },
        { label: '💾 Save now', fn: () => { H.save(); toast({ icon: '💾', title: 'Game saved', ttl: 2000 }); if (!wasPaused) H.pause(false); } },
        { label: UI.debug ? '🩺 Hide diagnostics' : '🩺 Diagnostics', fn: () => { UI.setDebug(!UI.debug); if (!wasPaused) H.pause(false); } },
        { label: '📖 How to play', fn: () => { UI.showHelp(); $('#modal')._onClose = () => { if (!wasPaused) H.pause(false); }; return true; } },
        { label: '🔁 New game', cls: 'danger', fn: () => { Modal.open({ title: 'Start over?', icon: '⚠️', body: '<p>Your current company will be deleted. This cannot be undone.</p>', actions: [{ label: 'Cancel', fn: () => { if (!wasPaused) H.pause(false); } }, { label: 'Delete & restart', cls: 'danger', fn: () => H.newGame() }] }); return true; } },
      ], onClose: () => { if (!wasPaused && !Modal.isOpen()) H.pause(false); } });
    },
    showWin() {
      const S = G.S;
      Confetti.burst(400, { power: 14 }); Sound.play('win');
      setTimeout(() => Confetti.burst(250, { power: 12, x: root.innerWidth * 0.25 }), 700);
      setTimeout(() => Confetti.burst(250, { power: 12, x: root.innerWidth * 0.75 }), 1400);
      const m = Modal.open({ title: 'YOU DID IT!', icon: '🏆', cls: 'win', body: `<p style="font-size:16px">${esc(S.company)} is worth <b class="gold">${fmt(S.valuation)}</b>. From a corner store with $1,000 to a billion-dollar empire in <b>${S.day} days</b>.</p>
        <div class="stat-grid"><div class="kv"><span>Businesses</span><span class="v">${S.businesses.length}</span></div><div class="kv"><span>Employees</span><span class="v">${G.totalStaff()}</span></div><div class="kv"><span>Total profit</span><span class="v">${fmt(S.stats.totalProfit)}</span></div><div class="kv"><span>Units sold</span><span class="v">${S.stats.unitsSold.toLocaleString()}</span></div><div class="kv"><span>Market rank</span><span class="v">#${S.rank}</span></div><div class="kv"><span>Achievements</span><span class="v">${Object.keys(S.achievements).length}/${ACHIEVEMENTS.length}</span></div></div>
        <p class="muted small">Keep playing to crush every rival, or start a new run on a harder difficulty.</p>`,
        actions: [{ label: '🔁 New game', fn: () => H.newGame() }, { label: '▶ Keep playing', cls: 'gold', fn: () => { S.flags.continued = true; H.pause(false); } }], onClose: () => H.pause(false) });
      m._locked = true;
    },
    showBankrupt() {
      const S = G.S; Sound.play('bad');
      const m = Modal.open({ title: 'BANKRUPT', icon: '💀', cls: 'dead', body: `<p>${esc(S.company)} could not pay its debts. The bank has seized everything.</p>
        <div class="stat-grid"><div class="kv"><span>Survived</span><span class="v">${S.day} days</span></div><div class="kv"><span>Peak value</span><span class="v">${fmt(S.stats.peakValue)}</span></div><div class="kv"><span>Businesses owned</span><span class="v">${S.stats.bizBought + 1}</span></div><div class="kv"><span>Total revenue</span><span class="v">${fmt(S.stats.totalRevenue)}</span></div></div>
        <p class="muted small">Tip: keep a cash buffer for wages and rent, and never let an overdraft run for more than a few days.</p>`,
        actions: [{ label: '🔁 Try again', cls: 'primary', fn: () => H.newGame() }] });
      m._locked = true;
    },
    showOffline(r) {
      Modal.open({ title: 'While you were away', icon: '⏰', body: `<p>Your managers ran the empire for <b>${r.days} days</b>.</p><div class="stat-grid"><div class="kv"><span>Cash</span><span class="v ${r.cashDelta >= 0 ? 'good' : 'bad'}">${sign(r.cashDelta)}${fmt(r.cashDelta)}</span></div><div class="kv"><span>Company value</span><span class="v ${r.valueDelta >= 0 ? 'good' : 'bad'}">${sign(r.valueDelta)}${fmt(r.valueDelta)}</span></div></div>`, actions: [{ label: 'Back to work', cls: 'primary' }] });
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
