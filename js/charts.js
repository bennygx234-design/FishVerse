/* =========================================================================
   MARKET MAYHEM — tiny canvas chart library (no dependencies)
   ========================================================================= */
(function (root) {
  'use strict';

  function prep(canvas, height) {
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const w = canvas.clientWidth || canvas.width || 300;
    const h = height || canvas.clientHeight || canvas.height || 120;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    if (canvas.style.height !== h + 'px') canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  const LBL = '600 11px Jakarta, system-ui, sans-serif';
  const TIP = '700 12.5px Outfit, system-ui, sans-serif';

  function fmtShort(n) {
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (n >= 1e12) s = (n / 1e12).toFixed(1) + 'T';
    else if (n >= 1e9) s = (n / 1e9).toFixed(1) + 'B';
    else if (n >= 1e6) s = (n / 1e6).toFixed(1) + 'M';
    else if (n >= 1e3) s = (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K';
    else s = n < 10 ? n.toFixed(1) : Math.round(n).toString();
    return (neg ? '-$' : '$') + s;
  }

  const Charts = {
    // Sparkline: no axes, gradient under the line
    spark(canvas, data, color = '#2dd4bf', height = 34) {
      const { ctx, w, h } = prep(canvas, height);
      if (!data || data.length < 2) return;
      const n = data.length;
      let min = Infinity, max = -Infinity;
      for (const v of data) { if (v < min) min = v; if (v > max) max = v; }
      if (max === min) { max += 1; min -= 1; }
      const x = i => (i / (n - 1)) * w;
      const y = v => h - 3 - ((v - min) / (max - min)) * (h - 6);
      ctx.beginPath();
      for (let i = 0; i < n; i++) i ? ctx.lineTo(x(i), y(data[i])) : ctx.moveTo(x(i), y(data[i]));
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, color + '40'); g.addColorStop(1, color + '00');
      ctx.fillStyle = g; ctx.fill();
    },

    // Line chart with axes, gradient fill and optional log scale + hover
    line(canvas, data, opts = {}) {
      const height = opts.height || 220;
      const { ctx, w, h } = prep(canvas, height);
      const color = opts.color || '#2dd4bf';
      const padL = 54, padR = 12, padT = 14, padB = 22;
      const iw = w - padL - padR, ih = h - padT - padB;
      if (!data || data.length < 2) {
        ctx.fillStyle = '#64718c'; ctx.font = LBL; ctx.textAlign = 'center';
        ctx.fillText('Not enough data yet', w / 2, h / 2); return;
      }
      const n = data.length;
      const log = !!opts.log;
      const tf = v => log ? Math.log10(Math.max(1, v)) : v;
      let min = Infinity, max = -Infinity;
      for (const v of data) { const t = tf(v); if (t < min) min = t; if (t > max) max = t; }
      if (opts.zero && !log) min = Math.min(min, 0);
      if (max === min) { max += 1; min -= 1; }
      const span = max - min;
      min -= span * 0.05; max += span * 0.08;
      const x = i => padL + (i / (n - 1)) * iw;
      const y = v => padT + ih - ((tf(v) - min) / (max - min)) * ih;
      // grid + labels
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
      ctx.fillStyle = '#64718c'; ctx.font = LBL; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const ticks = 4;
      for (let i = 0; i <= ticks; i++) {
        const t = min + (max - min) * (i / ticks);
        const yy = padT + ih - (i / ticks) * ih;
        ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke();
        const val = log ? Math.pow(10, t) : t;
        ctx.fillText(opts.fmt ? opts.fmt(val) : fmtShort(val), padL - 6, yy);
      }
      // x labels (days)
      if (opts.startDay != null) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const steps = Math.min(6, n - 1);
        for (let i = 0; i <= steps; i++) {
          const idx = Math.round((i / steps) * (n - 1));
          ctx.fillText('D' + (opts.startDay + idx), x(idx), h - padB + 6);
        }
      }
      // zero line
      if (!log && min < 0 && max > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(padL, y(0)); ctx.lineTo(w - padR, y(0)); ctx.stroke(); }
      // area
      ctx.beginPath();
      for (let i = 0; i < n; i++) i ? ctx.lineTo(x(i), y(data[i])) : ctx.moveTo(x(i), y(data[i]));
      const lastX = x(n - 1);
      ctx.lineTo(lastX, padT + ih); ctx.lineTo(padL, padT + ih); ctx.closePath();
      const g = ctx.createLinearGradient(0, padT, 0, padT + ih);
      g.addColorStop(0, color + '55'); g.addColorStop(1, color + '04');
      ctx.fillStyle = g; ctx.fill();
      // line
      ctx.beginPath();
      for (let i = 0; i < n; i++) i ? ctx.lineTo(x(i), y(data[i])) : ctx.moveTo(x(i), y(data[i]));
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = color + '2e'; ctx.lineWidth = 8; ctx.stroke();   // cheap glow (no shadowBlur)
      ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.stroke();
      // glowing end dot
      const ex = x(n - 1), ey = y(data[n - 1]);
      ctx.beginPath(); ctx.arc(ex, ey, 10, 0, Math.PI * 2); ctx.fillStyle = color + '33'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fillStyle = '#0b1020'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex, ey, 3.4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      // hover crosshair
      const hv = canvas._hover;
      if (hv != null && hv >= padL && hv <= w - padR) {
        const idx = Math.round(((hv - padL) / iw) * (n - 1));
        const hx = x(idx), hy = y(data[idx]);
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(hx, padT); ctx.lineTo(hx, padT + ih); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
        ctx.beginPath(); ctx.arc(hx, hy, 2.4, 0, Math.PI * 2); ctx.fillStyle = '#0b1020'; ctx.fill();
        const label = (opts.fmt ? opts.fmt(data[idx]) : fmtShort(data[idx])) + (opts.startDay != null ? `  ·  Day ${opts.startDay + idx}` : '');
        ctx.font = TIP;
        const tw = ctx.measureText(label).width + 18;
        let bx = hx + 12; if (bx + tw > w - padR) bx = hx - tw - 12;
        const by = Math.max(padT, Math.min(hy - 28, padT + ih - 26));
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
        ctx.fillStyle = '#1b2440';
        roundRect(ctx, bx, by, tw, 26, 9); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
        roundRect(ctx, bx, by, tw, 26, 9); ctx.stroke();
        ctx.fillStyle = '#eef3fd'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(label, bx + 9, by + 13);
      }
    },

    // Grouped bar chart (two series), supports negatives
    bars(canvas, a, b, opts = {}) {
      const height = opts.height || 220;
      const { ctx, w, h } = prep(canvas, height);
      const padL = 54, padR = 10, padT = 12, padB = 22;
      const iw = w - padL - padR, ih = h - padT - padB;
      const n = Math.max(a.length, b ? b.length : 0);
      if (n < 1) { ctx.fillStyle = '#64718c'; ctx.font = LBL; ctx.textAlign = 'center'; ctx.fillText('No data yet', w / 2, h / 2); return; }
      let min = 0, max = 0;
      for (const v of a) { if (v > max) max = v; if (v < min) min = v; }
      if (b) for (const v of b) { if (v > max) max = v; if (v < min) min = v; }
      if (max === min) max = min + 1;
      max *= 1.08; if (min < 0) min *= 1.08;
      const y = v => padT + ih - ((v - min) / (max - min)) * ih;
      const zeroY = y(0);
      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.fillStyle = '#64718c'; ctx.font = LBL; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const t = min + (max - min) * (i / 4), yy = y(t);
        ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke();
        ctx.fillText(fmtShort(t), padL - 6, yy);
      }
      const group = iw / n;
      const bw = Math.max(2, (group * 0.7) / (b ? 2 : 1));
      const ca = opts.colorA || '#5b9cff', cb = opts.colorB || '#2ee0b8', cneg = '#ff6b74';
      for (let i = 0; i < n; i++) {
        const gx = padL + i * group + group * 0.15;
        if (a[i] != null) { ctx.fillStyle = ca; drawBar(ctx, gx, zeroY, bw, y(a[i])); }
        if (b && b[i] != null) { ctx.fillStyle = b[i] < 0 ? cneg : cb; drawBar(ctx, gx + bw + 1, zeroY, bw, y(b[i])); }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(padL, zeroY); ctx.lineTo(w - padR, zeroY); ctx.stroke();
      if (opts.startDay != null) {
        ctx.fillStyle = '#64718c'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = LBL;
        const steps = Math.min(6, n - 1);
        for (let i = 0; i <= steps; i++) { const idx = Math.round((i / Math.max(1, steps)) * (n - 1)); ctx.fillText('D' + (opts.startDay + idx), padL + idx * group + group / 2, h - padB + 6); }
      }
    },

    // Animated background chart for the start screen
    bgLines(canvas, t) {
      const { ctx, w, h } = prep(canvas, canvas.clientHeight);
      const cols = ['#5b9cff', '#2ee0b8', '#9d8cff', '#ffc043'];
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const yy = h * 0.65 - (x / w) * h * 0.35 + Math.sin(x * 0.012 + t * 0.0012 + k) * 22 + Math.sin(x * 0.03 + t * 0.002 + k * 2) * 8 + k * 30;
          x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
        }
        ctx.strokeStyle = cols[k]; ctx.globalAlpha = 0.34; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke(); ctx.globalAlpha = 1;
      }
    },
    fmtShort,
  };

  function drawBar(ctx, x, zeroY, bw, yv) {
    const top = Math.min(zeroY, yv), hgt = Math.max(1, Math.abs(zeroY - yv));
    roundRect(ctx, x, top, bw, hgt, Math.min(bw / 2, hgt / 2, 5)); ctx.fill();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  root.MM_CHARTS = Charts;
})(typeof window !== 'undefined' ? window : globalThis);
