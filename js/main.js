/* =========================================================================
   MARKET MAYHEM — bootstrap, game loop, start screen, keyboard, persistence
   ========================================================================= */
(function () {
  'use strict';
  const D = window.MM_DATA, { Game } = window.MM_ENGINE, UI = window.MM_UI;
  const $ = sel => document.querySelector(sel);

  const game = new Game();
  window.MM = { game, UI }; // handy for debugging / testing

  // ---------- loop state ---------------------------------------------------------
  let speed = 1, paused = false, acc = 0, last = performance.now(), running = false;
  const MS_PER_DAY = 1000;

  function setSpeed(s) {
    if (s === 0) { paused = true; return; }
    speed = s; paused = false; acc = 0;
  }
  function pause(on) { paused = on; acc = 0; }
  function loop(now) {
    if (running) {
      const S = game.S;
      if (S && !paused && speed > 0 && !S.flags.bankrupt) {
        acc += Math.min(250, now - last);
        const interval = MS_PER_DAY / speed;
        let guard = 0;
        while (acc >= interval && guard++ < 16) {
          acc -= interval;
          game.tick();
          if (S.events.pending || S.flags.bankrupt || (S.flags.won && !S.flags.continued)) { acc = 0; break; }
        }
      }
      UI.frame(now);
    }
    last = now;
    requestAnimationFrame(loop);
  }

  const hooks = {
    setSpeed, getSpeed: () => (paused ? 0 : speed), pause, isPaused: () => paused,
    save: () => game.save(!paused),
    newGame: () => { Game.clearSave(); showStart(); },
  };

  // ---------- start screen ------------------------------------------------------
  let difficulty = 'normal';
  let bgAnim = null;
  function showStart() {
    running = false; paused = true;
    $('#app').classList.add('hidden');
    $('#startScreen').classList.remove('hidden');
    UI.Modal.close();
    const save = Game.peekSave();
    const cont = $('#btnContinue');
    if (save && save.version === 1 && !save.flags.bankrupt) { cont.classList.remove('hidden'); cont.textContent = `▶ Continue ${save.company} (Day ${save.day})`; }
    else cont.classList.add('hidden');
    if (!$('#companyInput').value) $('#companyInput').value = randomName();
    renderDiff();
    const c = $('#bgChart');
    const tick = t => { if ($('#startScreen').classList.contains('hidden')) { bgAnim = null; return; } window.MM_CHARTS.bgLines(c, t); bgAnim = requestAnimationFrame(tick); };
    if (!bgAnim) bgAnim = requestAnimationFrame(tick);
  }
  function renderDiff() {
    $('#diffRow').innerHTML = Object.keys(D.DIFFICULTY).map(k => `<button class="diff-btn ${difficulty === k ? 'active' : ''}" data-diff="${k}"><b>${D.DIFFICULTY[k].name}</b><span>${D.DIFFICULTY[k].desc}</span></button>`).join('');
    document.querySelectorAll('.diff-btn').forEach(b => b.addEventListener('click', () => { difficulty = b.dataset.diff; renderDiff(); UI.Sound.play('click'); }));
  }
  function randomName() {
    const a = ['Pixel', 'Nova', 'Apex', 'Blue Sky', 'Golden', 'Rocket', 'Maple', 'Quantum', 'Sunrise', 'Iron', 'Lucky', 'Velvet', 'Atlas', 'Cobalt'];
    const b = ['& Co.', 'Holdings', 'Ventures', 'Trading', 'Group', 'Industries', 'Enterprises', 'Corp', 'Retail', 'Bros.'];
    return a[Math.floor(Math.random() * a.length)] + ' ' + b[Math.floor(Math.random() * b.length)];
  }
  function startGame(fromSave) {
    UI.Sound.ensure();
    if (fromSave) {
      if (!game.load()) { fromSave = false; }
    }
    if (!fromSave) {
      const name = ($('#companyInput').value || 'Pixel & Co.').trim().slice(0, 24) || 'Pixel & Co.';
      game.newGame({ company: name, difficulty });
    }
    $('#startScreen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    UI.detailBiz = null; UI.view = 'dashboard'; UI.structKey = '';
    UI.rebuildFeed();
    UI.showView('dashboard');
    running = true; paused = false; speed = 1; acc = 0; last = performance.now();
    UI.updateSpeedButtons();
    if (fromSave) {
      const r = game.offlineProgress(20, MS_PER_DAY / 1000);
      UI.render(true);
      if (r && r.days > 0) { UI.showOffline(r); }
      UI.toast({ icon: '👋', title: `Welcome back, ${game.S.company}`, desc: `Day ${game.S.day}. The markets missed you.`, ttl: 4000 });
      if (game.S.events.pending) { const def = D.EVENTS.find(e => e.id === game.S.events.pending.id); UI.showChoice({ def, param: game.S.events.pending.param, desc: game.S.events.pending.desc }); }
    } else {
      UI.toast({ icon: '🏪', title: `Welcome, ${game.S.company}!`, desc: 'Your corner store is open. Keep shelves full, hire smart, and grow.', kind: 'good', ttl: 7000 });
      setTimeout(() => UI.toast({ icon: '💡', title: 'First steps', desc: 'Open Businesses → Corner Store to restock, then visit the Bank for growth capital.', ttl: 9000 }), 2500);
    }
    game.save(true);
  }

  // ---------- keyboard ----------------------------------------------------------------
  document.addEventListener('keydown', e => {
    if (!running) return;
    const tag = (e.target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.key === 'Escape') { if (UI.Modal.isOpen() && !$('#modal')._locked) UI.Modal.close(); return; }
    if (UI.Modal.isOpen()) return;
    if (e.code === 'Space') { e.preventDefault(); if (paused) setSpeed(speed); else setSpeed(0); UI.updateSpeedButtons(); UI.Sound.play('click'); }
    else if (e.key === '1') setSpeed(1); else if (e.key === '2') setSpeed(2); else if (e.key === '3') setSpeed(4); else if (e.key === '4') setSpeed(8);
    else if (e.key === 'd' || e.key === 'D') UI.showView('dashboard'); else if (e.key === 'b' || e.key === 'B') UI.showView('businesses');
    else if (e.key === 'm' || e.key === 'M') UI.showView('market'); else if (e.key === 'k' || e.key === 'K') UI.showView('bank');
    else if (e.key === 'h' || e.key === 'H') UI.showView('hq'); else if (e.key === 'r' || e.key === 'R') UI.showView('rivals');
    UI.updateSpeedButtons();
  });

  // ---------- persistence hooks --------------------------------------------------------
  window.addEventListener('beforeunload', () => { if (running && game.S) game.save(!paused); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && game.S) game.save(!paused); });

  // ---------- boot ------------------------------------------------------------------
  UI.init(game, hooks);
  $('#btnNewGame').addEventListener('click', () => { UI.Sound.play('click'); if (Game.hasSave()) { UI.Modal.open({ title: 'Overwrite saved game?', icon: '⚠️', body: '<p>Starting a new game deletes your saved company.</p>', actions: [{ label: 'Cancel' }, { label: 'Start new game', cls: 'danger', fn: () => { Game.clearSave(); startGame(false); } }] }); } else startGame(false); });
  $('#btnContinue').addEventListener('click', () => { UI.Sound.play('click'); startGame(true); });
  $('#companyInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnNewGame').click(); });
  showStart();
  requestAnimationFrame(loop);
})();
