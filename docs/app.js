// Total Monthly Pricing: picks -> receipt. Nothing is stored; state lives in the URL hash.
(() => {
  const data = JSON.parse(document.getElementById('data').textContent);
  const byId = new Map(data.items.map((it) => [it.id, it]));
  const END = data.end;
  const $ = (s) => document.querySelector(s);
  const picker = $('#picker');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const per = (p) => (p === 'month' ? '/mo' : '/yr');
  const host = (u) => new URL(u).hostname.replace(/^www\./, '');
  const short = (d) => { const [y, m, day] = d.split('-'); return `${m}/${day}/${y.slice(2)}`; };

  // state: ordered map of id -> price the user typed (null = list price)
  const sel = new Map();
  let age = 30;

  const parsePrice = (raw) => {
    const s = String(raw).replace(/[$,\s]/g, '');
    if (s === '') return null;
    if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return NaN;
    const n = Number(s);
    return n > 0 ? n : NaN;
  };
  const clampAge = (n) => Math.min(79, Math.max(13, Math.round(n)));
  const priceOf = (id) => sel.get(id) ?? byId.get(id).price;
  const monthlyOf = (id) => (byId.get(id).per === 'month' ? priceOf(id) : priceOf(id) / 12);
  const totalMonthly = () => [...sel.keys()].reduce((s, id) => s + monthlyOf(id), 0);

  // ---------- URL hash ----------
  const toHash = () => {
    const p = [...sel].map(([id, v]) => (v == null ? id : `${id}~${v}`)).join(',');
    return `#p=${p}&age=${age}`;
  };
  const readHash = () => {
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.has('p')) return false;
    sel.clear();
    for (const tok of (h.get('p') || '').split(',')) {
      const m = /^([a-z0-9-]{1,40})(?:~(\d{1,4}(?:\.\d{1,2})?))?$/.exec(tok.trim());
      if (!m || !byId.has(m[1]) || sel.has(m[1])) continue;
      const v = m[2] ? Number(m[2]) : null;
      sel.set(m[1], v && v > 0 && v !== byId.get(m[1]).price ? v : null);
    }
    const a = Number(h.get('age'));
    if (Number.isFinite(a) && a > 0) age = clampAge(a);
    return true;
  };
  let hashTimer;
  const writeHash = () => { clearTimeout(hashTimer); hashTimer = setTimeout(() => history.replaceState(null, '', toHash()), 150); };

  // ---------- receipt ----------
  const lines = $('#r-lines');
  const lineEl = (id, fresh) => {
    const it = byId.get(id);
    const p = priceOf(id);
    const yearly = it.per === 'month' ? p * 12 : p;
    const li = document.createElement('li');
    li.className = 'ln' + (fresh && !reduced ? ' new' : '');
    li.dataset.id = id;
    li.innerHTML = `<div class="ln-top"><span class="ln-name"></span><span class="ln-price">${usd(p)}${per(it.per)}</span></div>
<div class="ln-life"><span>to age ${END}</span><span>${usd(yearly * (END - age))}</span></div>
${sel.get(id) != null ? `<div class="ln-then">Your price. List price ${usd(it.price)}${per(it.per)}</div>` : ''}
${it.then ? `<div class="ln-then">In ${it.then.year}: <a href="${it.then.url}" rel="noopener">${usd(it.then.price)}${per(it.then.per)}</a></div>` : ''}
<div class="ln-src">src <a href="${it.source}" rel="noopener">${host(it.source)}</a> ${short(it.checked)}</div>`;
    li.querySelector('.ln-name').textContent = `${it.service} ${it.plan}`;
    return li;
  };
  const render = (freshId) => {
    const frag = document.createDocumentFragment();
    for (const id of sel.keys()) frag.append(lineEl(id, id === freshId));
    lines.replaceChildren(frag);
    $('#r-empty').hidden = sel.size > 0;
    const m = totalMonthly();
    $('#t-month').textContent = usd(m);
    $('#t-year').textContent = usd(m * 12);
    $('#t-life').textContent = usd(m * 12 * (END - age));
    const life = usd(m * 12 * (END - age));
    $('#t-day').textContent = usd((m * 12) / 365.25);
    $('#r-age').textContent = age;
    $('#r-years').textContent = END - age;
    $('#peek-month').textContent = usd(m);
    $('#peek-life').textContent = life;
    $('#save').textContent = sel.size ? `Save your ${life} receipt` : 'Save receipt image';
    if (freshId) showTotals();
    if (freshId && !reduced) { const g = $('.r-due-amt'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); }
  };

  // Desktop: the receipt column scrolls on its own. Keep the new line and the totals in view.
  const printer = $('.printer');
  const showTotals = () => {
    if (getComputedStyle(printer).overflowY !== 'auto' || printer.scrollHeight <= printer.clientHeight) return;
    const tot = $('.r-tot').getBoundingClientRect(), box = printer.getBoundingClientRect();
    const target = printer.scrollTop + (tot.bottom - box.bottom) + 140;
    if (target > printer.scrollTop) printer.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
  };

  // ---------- picker ----------
  const syncPicker = () => {
    for (const li of picker.querySelectorAll('.pick')) {
      const id = li.dataset.id;
      const on = sel.has(id);
      li.querySelector('input[type=checkbox]').checked = on;
      li.classList.toggle('on', on);
      const inp = li.querySelector('.pk-edit input');
      inp.value = sel.get(id) != null ? sel.get(id).toFixed(2) : '';
      inp.removeAttribute('aria-invalid');
    }
    $('#age').value = age;
  };
  picker.addEventListener('change', (e) => {
    const t = e.target;
    if (t.type === 'checkbox') {
      const li = t.closest('.pick');
      if (t.checked) sel.set(t.value, null); else sel.delete(t.value);
      li.classList.toggle('on', t.checked);
      li.querySelector('.pk-edit input').value = '';
      render(t.checked ? t.value : null);
      writeHash();
    }
  });
  picker.addEventListener('input', (e) => {
    const t = e.target;
    if (t.closest('.pk-edit')) {
      const id = t.closest('.pick').dataset.id;
      const v = parsePrice(t.value);
      if (Number.isNaN(v)) { t.setAttribute('aria-invalid', 'true'); return; }
      t.removeAttribute('aria-invalid');
      sel.set(id, v === byId.get(id).price ? null : v);
      render(); writeHash();
    } else if (t.id === 'age') {
      const a = Number(t.value);
      if (!t.value || !Number.isFinite(a)) return;
      age = clampAge(a);
      render(); writeHash();
    } else if (t.id === 'find') {
      const q = t.value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
      let any = false;
      for (const fs of picker.querySelectorAll('.group')) {
        let vis = 0;
        for (const li of fs.querySelectorAll('.pick')) { const hit = !q || li.dataset.q.includes(q); li.hidden = !hit; vis += hit; }
        fs.hidden = vis === 0; any ||= vis > 0;
      }
      $('#nomatch').hidden = any;
    }
  });
  $('#age').addEventListener('blur', (e) => { e.target.value = age; });

  // ---------- ticker (folded in from Foil's T3 note) ----------
  const t0 = performance.now();
  const tick = () => {
    const perSec = (totalMonthly() * 12) / 365.25 / 86400;
    $('#r-tick').textContent = '$' + (perSec * (performance.now() - t0) / 1000).toFixed(6);
  };
  setInterval(tick, reduced ? 1000 : 100);


  // Switch to https://totalmonthlypricing.com/ at go-live.
  const CANONICAL = 'https://evanmack45.github.io/totalmonthlypricing-preview/';
  const isLocalPage = () => location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const publicPage = () => (isLocalPage() ? CANONICAL : `${location.origin}${location.pathname}`).replace(/index\.html$/, '').replace(/\/?$/, '/');
  const publicLink = (hash) => `${publicPage()}${hash && hash !== '#' ? (hash.startsWith('#') ? hash : '#' + hash) : ''}`;
  const publicFooter = (hash) => publicLink(hash).replace(/^https?:\/\//, '');

  // ---------- share ----------
  const msg = $('#share-msg');
  const say = (s) => { msg.textContent = s; clearTimeout(say.t); say.t = setTimeout(() => (msg.textContent = ''), 4000); };
  $('#share').addEventListener('click', async () => {
    history.replaceState(null, '', toHash());
    const url = publicLink(toHash());
    try { await navigator.clipboard.writeText(url); say('Link copied. It holds your picks, nothing else.'); }
    catch { say('Copy this link: ' + url); }
  });

  const drawReceipt = async () => {
    await Promise.all([document.fonts.load('22px Departure'), document.fonts.load('52px Departure')]);
    const W = 576, PAD = 36, LH = 30, F = '22px Departure, monospace';
    const rows = [];
    const ctx0 = document.createElement('canvas').getContext('2d'); ctx0.font = F;
    const cw = ctx0.measureText('M').width, cols = Math.floor((W - PAD * 2) / cw);
    const wrap = (s, n) => {
      const out = []; let cur = '';
      const flushTok = (tok) => {
        if (tok.length > n) {
          if (cur) { out.push(cur); cur = ''; }
          for (let i = 0; i < tok.length; i += n) out.push(tok.slice(i, i + n));
          return;
        }
        const t = cur ? `${cur} ${tok}` : tok;
        if (t.length > n && cur) { out.push(cur); cur = tok; } else cur = t;
      };
      for (const w of String(s).split(' ')) flushTok(w);
      if (cur) out.push(cur);
      return out;
    };
    const C = (s) => wrap(s, cols).forEach((p) => rows.push({ c: p })); const LR = (l, r) => rows.push({ l, r }); const L = (l) => rows.push({ l }); const D = () => rows.push({ dash: 1 }); const S = (h) => rows.push({ gap: h });
    const m = totalMonthly();
    const life = usd(m * 12 * (END - age));
    const day = usd(m * 12 / 365.25);
    C('TOTAL MONTHLY PRICING'); C('Receipt for one life'); C('Prices as of ' + data.asOf); C(`Age ${age} to ${END} (${END - age} years)`); D();
    rows.push({ hero: 1, kicker: 'TO AGE ' + END, amount: life, sub: `${day} a day, every day` }); D();
    for (const id of sel.keys()) {
      const it = byId.get(id); const p = priceOf(id); const y = it.per === 'month' ? p * 12 : p;
      const pr = usd(p) + per(it.per); const nm = wrap(`${it.service} ${it.plan}`, cols - pr.length - 1);
      nm.forEach((n, i) => (i === 0 ? LR(n, pr) : L(n)));
      LR('  to age ' + END, usd(y * (END - age)));
      if (sel.get(id) != null) L('  your price, list ' + usd(it.price));
      if (it.then) L(`  in ${it.then.year}: ${usd(it.then.price)}${per(it.then.per)}`);
      L(`  src ${host(it.source)} ${short(it.checked)}`); S(6);
    }
    if (!sel.size) C('(nothing ticked)');
    D(); LR('TOTAL MONTHLY', usd(m)); LR('TOTAL YEARLY', usd(m * 12));
    D(); C("Today's list prices, held flat."); C('Taxes not included.'); S(10); rows.push({ bar: 1 }); S(8); C('THANK YOU FOR SUBSCRIBING');
    const foot = publicFooter('').replace(/#$/, '').replace(/\/$/, '');
    const slash = foot.indexOf('/');
    if (slash > 0 && slash < cols && foot.length > cols) { C(foot.slice(0, slash + 1)); C(foot.slice(slash + 1)); }
    else wrap(foot, cols).forEach((ln) => rows.push({ c: ln }));
    const hOf = (r) => (r.gap ?? (r.hero ? 128 : r.bar ? 64 : r.big ? 44 : r.dash ? 22 : LH));
    const H = PAD * 2 + rows.reduce((s, r) => s + hOf(r), 0) + 24;
    const cv = document.createElement('canvas'); const k = 2; cv.width = W * k; cv.height = H * k;
    const g = cv.getContext('2d'); g.scale(k, k);
    g.fillStyle = '#fffdf6'; g.fillRect(0, 0, W, H);
    try {
      const perf = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'img/perforation.webp'; });
      const ph = 14;
      g.drawImage(perf, 0, Math.floor(perf.height * 0.35), perf.width, Math.floor(perf.height * 0.3), 0, 0, W, ph);
    } catch { /* decorative; receipt still prints without it */ }
    // torn bottom edge
    g.fillStyle = '#ece6da'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 12) g.lineTo(x, H - (x / 12 % 2 ? 10 : 0)); g.lineTo(W, H); g.fill();
    g.fillStyle = '#26252c'; g.textBaseline = 'top';
    let yy = PAD;
    for (const r of rows) {
      const h = hOf(r);
      if (r.dash) { g.fillText('-'.repeat(cols), PAD, yy); }
      else if (r.bar) { let x = PAD + 40; let s = 7; while (x < W - PAD - 40) { s = (s * 9301 + 49297) % 233280; const w = 2 + (s % 4) * 2; g.fillRect(x, yy, w, 56); x += w + 2 + (s % 3) * 2; } }
      else if (r.hero) {
        g.textAlign = 'center';
        g.fillStyle = '#57555f'; g.font = F; g.fillText(r.kicker, W / 2, yy + 4);
        g.fillStyle = '#b2300b'; g.font = '52px Departure, monospace'; g.fillText(r.amount, W / 2, yy + 36);
        g.fillStyle = '#26252c'; g.font = F; g.fillText(r.sub, W / 2, yy + 100);
        g.textAlign = 'left';
      }
      else if (r.c) { g.fillStyle = '#26252c'; g.font = F; g.textAlign = 'center'; g.fillText(r.c, W / 2, yy); g.textAlign = 'left'; }
      else if (r.big) { g.font = '33px Departure, monospace'; g.fillText(r.l, PAD, yy); g.textAlign = 'right'; g.fillText(r.r, W - PAD, yy); g.textAlign = 'left'; g.font = F; }
      else if (r.l !== undefined) { g.font = F; g.fillText(r.l, PAD, yy); if (r.r) { g.textAlign = 'right'; g.fillText(r.r, W - PAD, yy); g.textAlign = 'left'; } }
      yy += h;
    }
    return cv;
  };
  $('#save').addEventListener('click', async () => {
    const cv = await drawReceipt();
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const file = new File([blob], `receipt-to-age-${END}.png`, { type: 'image/png' });
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch { /* fall through to download */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = file.name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say('Receipt image saved.');
  });

  window.__receipt = drawReceipt;

  // ---------- phone peek bar ----------
  const peek = $('#peek');
  if ('IntersectionObserver' in window) {
    let rVis = true, pVis = false;
    const upd = () => (peek.hidden = rVis || !pVis);
    new IntersectionObserver(([e]) => { rVis = e.isIntersecting; upd(); }, { threshold: 0.15 }).observe($('#receipt'));
    new IntersectionObserver(([e]) => { pVis = e.isIntersecting; upd(); }).observe(picker);
  }

  // ---------- start ----------
  if (!readHash()) { sel.clear(); for (const id of data.example) sel.set(id, null); }
  syncPicker();
  render();
  addEventListener('hashchange', () => { if (readHash()) { syncPicker(); render(); } });
})();
