// Total Monthly Pricing: picks -> receipt. Nothing is stored; state lives in the URL hash.
(() => {
  const data = JSON.parse(document.getElementById('data').textContent);
  const byId = new Map(data.items.map((it) => [it.id, it]));
  const END = data.end;
  // One plan per service: tiers of the same service exclude each other (Netflix Standard vs Premium, and so on).
  const tiers = new Map();
  for (const it of data.items) { if (!tiers.has(it.service)) tiers.set(it.service, []); tiers.get(it.service).push(it.id); }
  const sibsOf = (id) => tiers.get(byId.get(id).service).filter((x) => x !== id);
  const $ = (s) => document.querySelector(s);
  const picker = $('#picker');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Money is integer cents. A monthly plan bills 12 times a year; a yearly plan bills once.
  // We never divide a yearly price by 12 for the monthly total: 99.99/12 is 8.3325, and
  // rounding that would make "monthly x 12" a different number than the person is billed.
  const cents = (n) => Math.round(Number(n) * 100);
  const usd = (c) => {
    const n = Math.round(c), sign = n < 0 ? '-' : '', a = Math.abs(n);
    return `${sign}$${Math.floor(a / 100).toLocaleString('en-US')}.${String(a % 100).padStart(2, '0')}`;
  };
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
  const isMonth = (id) => byId.get(id).per === 'month';
  const priceC = (id) => cents(priceOf(id));
  const monthC = (id) => (isMonth(id) ? priceC(id) : 0);
  const yearC = (id) => (isMonth(id) ? priceC(id) * 12 : priceC(id));
  const sums = () => {
    let m = 0, y = 0;
    for (const id of sel.keys()) { m += monthC(id); y += yearC(id); }
    return { m, y, a: y - m * 12, life: y * (END - age) };
  };

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
      if (sibsOf(m[1]).some((s) => sel.has(s))) continue; // second tier of a service: keep the first one listed
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
    const p = priceC(id), y = yearC(id);
    const li = document.createElement('li');
    li.className = 'ln' + (fresh && !reduced ? ' new' : '');
    li.dataset.id = id;
    li.innerHTML = `<div class="ln-top"><span class="ln-name"></span><span class="ln-price">${usd(p)}${per(it.per)}</span></div>
<div class="ln-life"><span>to age ${END}</span><span>${usd(y * (END - age))}</span></div>
${sel.get(id) != null ? `<div class="ln-then">Your price. List price ${usd(cents(it.price))}${per(it.per)}</div>` : ''}
${it.then ? `<div class="ln-then">In ${it.then.year}: <a href="${it.then.url}" rel="noopener">${usd(cents(it.then.price))}${per(it.then.per)}</a></div>` : ''}
<div class="ln-src">src <a href="${it.source}" rel="noopener">${host(it.source)}</a> ${short(it.checked)}</div>`;
    li.querySelector('.ln-name').textContent = `${it.service} ${it.plan}`;
    return li;
  };
  const render = (freshId) => {
    const frag = document.createDocumentFragment();
    for (const id of sel.keys()) frag.append(lineEl(id, id === freshId));
    lines.replaceChildren(frag);
    $('#r-empty').hidden = sel.size > 0;
    const isExample = age === 30 && data.example.length === sel.size && data.example.every((id) => sel.has(id) && sel.get(id) == null);
    const ex = $('#r-example'); if (ex) ex.hidden = !isExample;
    const { m, y, a, life } = sums();
    const lifeTxt = usd(life);
    $('#t-month').textContent = usd(m);
    $('#t-year').textContent = usd(y);
    $('#t-life').textContent = lifeTxt;
    $('#t-annual').textContent = usd(a);
    $('#t-annual-row').hidden = a === 0;
    $('#t-day').textContent = usd(Math.round(y / 365.25));
    $('#r-age').textContent = age;
    $('#r-years').textContent = END - age;
    $('#peek-month').textContent = a ? `${usd(m)} a month + ${usd(a)} a year` : `${usd(m)} a month`;
    $('#peek-life').textContent = lifeTxt;
    $('#save').textContent = sel.size ? `Save your ${lifeTxt} receipt` : 'Save receipt image';
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
  const swapNote = $('#swap-note');
  const noteSwap = (from, to) => {
    clearTimeout(noteSwap.t);
    if (!from || !to) { swapNote.textContent = ''; return; }
    const a = byId.get(from), b = byId.get(to);
    swapNote.textContent = `${b.service}: switched from ${a.plan} to ${b.plan}. One plan per service.`;
    noteSwap.t = setTimeout(() => (swapNote.textContent = ''), 5000);
  };
  picker.addEventListener('change', (e) => {
    const t = e.target;
    if (t.type === 'checkbox') {
      const li = t.closest('.pick');
      let swapped = null;
      if (t.checked) {
        for (const s of sibsOf(t.value)) if (sel.has(s)) { swapped = s; sel.delete(s); }
        sel.set(t.value, null);
      } else sel.delete(t.value);
      li.querySelector('.pk-edit input').value = '';
      syncPicker();
      noteSwap(swapped, t.checked ? t.value : null);
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
    const perSec = (sums().y / 100) / 365.25 / 86400;
    $('#r-tick').textContent = '$' + (perSec * (performance.now() - t0) / 1000).toFixed(6);
  };
  setInterval(tick, reduced ? 1000 : 100);


  // Switch to https://totalmonthlypricing.com/ at go-live.
  const CANONICAL = 'https://totalmonthlypricing.com/';
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

  // Share image: a 4:5 card, 1080x1350. Hero number, the 5 costliest lines that fit, "+N more" with its
  // monthly sum, totals, and the canonical URL. Every shown line keeps its source host; the footer points at
  // the page where all 58 sources are listed.
  const SHARE_W = 540, SHARE_H = 675, SHARE_MAX_LINES = 5;
  const drawReceipt = async () => {
    await Promise.all([document.fonts.load('20px Departure'), document.fonts.load('16px Departure'), document.fonts.load('52px Departure')]);
    const W = SHARE_W, H = SHARE_H, PAD = 36, K = 2;
    const F = '20px Departure, monospace', F2 = '16px Departure, monospace';
    const meas = document.createElement('canvas').getContext('2d');
    const colsFor = (font) => { meas.font = font; return Math.floor((W - PAD * 2) / meas.measureText('M').width); };
    const cols = colsFor(F), cols2 = colsFor(F2);
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
    const HT = { c: 25, lr: 24, lr2: 19, dash: 10, hero: 96, bar: 56 };
    const row = (type, o = {}) => ({ type, h: o.gap ?? HT[type], ...o });
    const C = (s) => wrap(s, cols).map((c) => row('c', { s: c }));
    const DASH = () => row('dash');
    const { m, y, a, life } = sums();
    const lifeTxt = usd(life);
    const day = usd(Math.round(y / 365.25));

    // one shown line = 2 rows (name + price, then lifetime + source host), plus optional detail rows
    const lineRows = (id, withThen) => {
      const it = byId.get(id); const p = priceC(id); const yv = yearC(id);
      const pr = usd(p) + per(it.per);
      const out = [];
      wrap(`${it.service} ${it.plan}`, cols - pr.length - 1).forEach((n, i) => out.push(row('lr', { l: n, r: i === 0 ? pr : '' })));
      const amt = usd(yv * (END - age)); const h = host(it.source);
      const left = `  to ${END} src ${h}`;
      if (left.length + 1 + amt.length <= cols2) out.push(row('lr2', { l: left, r: amt }));
      else { out.push(row('lr2', { l: `  to ${END}`, r: amt })); wrap(`src ${h}`, cols2 - 2).forEach((s) => out.push(row('lr2', { l: '  ' + s }))); }
      if (sel.get(id) != null) out.push(row('lr2', { l: `  your price, list ${usd(cents(it.price))}` }));
      if (withThen && it.then) out.push(row('lr2', { l: `  in ${it.then.year}: ${usd(cents(it.then.price))}${per(it.then.per)}` }));
      out.push(row('gap', { gap: 3 }));
      return out;
    };
    const sum = (rs) => rs.reduce((s, r) => s + r.h, 0);

    const head = [...C('TOTAL MONTHLY PRICING'), ...C('Receipt for one life'), ...C(`Age ${age} to ${END}, prices ${data.asOf}`), DASH(), row('hero', { kicker: 'TO AGE ' + END, amount: lifeTxt, sub: `${day} a day, every day` }), DASH()];
    const foot = publicFooter('').replace(/#$/, '').replace(/\/$/, '');
    const slash = foot.indexOf('/');
    const urlRows = (slash > 0 && slash < cols && foot.length > cols) ? [...C(foot.slice(0, slash + 1)), ...C(foot.slice(slash + 1))] : wrap(foot, cols).map((s) => row('c', { s }));
    const tailA = [DASH(), row('lr', { l: 'TOTAL MONTHLY', r: usd(m) }), ...(a ? [row('lr', { l: 'YEARLY PLANS', r: usd(a) })] : []), row('lr', { l: 'TOTAL YEARLY', r: usd(y) })];
    const tailB = [DASH(), ...C('List prices, flat, pre-tax. Sources:')];
    const TOP = 20, BOT = 12;
    const ids = [...sel.keys()].sort((a, b) => yearC(b) - yearC(a) || monthC(b) - monthC(a));
    const fixed = TOP + sum(head) + sum(tailA) + sum(tailB) + sum(urlRows) + BOT;
    const pickLines = (withThen) => {
      const shown = []; let used = 0;
      for (const id of ids.slice(0, SHARE_MAX_LINES)) {
        const rs = lineRows(id, withThen);
        const moreRow = ids.length > shown.length + 1 ? HT.c : 0;
        if (fixed + used + sum(rs) + moreRow > H) break;
        shown.push({ id, rs }); used += sum(rs);
      }
      return shown;
    };
    let shown = pickLines(true);
    if (shown.length < Math.min(SHARE_MAX_LINES, ids.length)) { const alt = pickLines(false); if (alt.length > shown.length) shown = alt; }
    const hidden = ids.filter((id) => !shown.some((s) => s.id === id));
    const body = shown.flatMap((s) => s.rs);
    if (!sel.size) body.push(...C('(nothing ticked)'));
    const moreOf = (list) => {
      const mm = list.reduce((s, id) => s + monthC(id), 0);
      const aa = list.reduce((s, id) => s + yearC(id) - monthC(id) * 12, 0);
      const bits = [];
      if (mm) bits.push(`${usd(mm)}/mo`);
      if (aa) bits.push(`${usd(aa)}/yr`);
      return `+${list.length} more` + (bits.length ? `, ${bits.join(' + ')}` : '');
    };
    if (hidden.length) body.push(row('c', { s: moreOf(hidden) }));

    const rows = [...head, ...body, ...tailA];
    const free = H - TOP - BOT - sum(rows) - sum(tailB) - sum(urlRows);
    const decor = [row('bar'), row('c', { s: 'THANK YOU FOR SUBSCRIBING' })];
    if (free >= sum(decor) + 24) { const s = Math.floor((free - sum(decor)) / 2); rows.push(row('gap', { gap: s }), ...decor, row('gap', { gap: free - sum(decor) - s })); }
    else rows.push(row('gap', { gap: Math.max(0, free) }));
    rows.push(...tailB, ...urlRows);

    const cv = document.createElement('canvas'); cv.width = W * K; cv.height = H * K;
    const g = cv.getContext('2d'); g.scale(K, K);
    g.fillStyle = '#fffdf6'; g.fillRect(0, 0, W, H);
    try {
      const perf = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'img/perforation.webp'; });
      g.drawImage(perf, 0, Math.floor(perf.height * 0.35), perf.width, Math.floor(perf.height * 0.3), 0, 0, W, 14);
    } catch { /* decorative; receipt still prints without it */ }
    try {
      const ring = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'img/coffee-ring.webp'; });
      // Source ring is ~720px in an 800 canvas; draw at the 600px spec size, scaled to this card.
      const size = 800 * (600 / 720) * (W / 576);
      const heroBottom = TOP + sum(head);
      let rx = -size * 0.52;
      let ry = H - size * 0.78;
      if (ry < heroBottom - 24) ry = heroBottom - 24;
      g.save(); g.globalAlpha = 0.4; g.drawImage(ring, rx, ry, size, size); g.restore();
    } catch { /* decorative; receipt still prints without it */ }
    g.fillStyle = '#ece6da'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 12) g.lineTo(x, H - (x / 12 % 2 ? 10 : 0)); g.lineTo(W, H); g.fill();
    g.fillStyle = '#26252c'; g.textBaseline = 'top';
    let yy = TOP;
    for (const r of rows) {
      g.fillStyle = '#26252c';
      if (r.type === 'dash') { g.font = F; g.textAlign = 'left'; g.fillText('-'.repeat(cols), PAD, yy - 5); }
      else if (r.type === 'bar') { let x = PAD + 40; let s = 7; while (x < W - PAD - 40) { s = (s * 9301 + 49297) % 233280; const w = 2 + (s % 4) * 2; g.fillRect(x, yy, w, 48); x += w + 2 + (s % 3) * 2; } }
      else if (r.type === 'hero') {
        g.textAlign = 'center';
        g.fillStyle = '#57555f'; g.font = F; g.fillText(r.kicker, W / 2, yy + 2);
        g.fillStyle = '#b2300b'; g.font = '52px Departure, monospace'; g.fillText(r.amount, W / 2, yy + 22);
        g.fillStyle = '#26252c'; g.font = F; g.fillText(r.sub, W / 2, yy + 74);
        g.textAlign = 'left';
      }
      else if (r.type === 'c') { g.fillStyle = '#26252c'; g.font = F; g.textAlign = 'center'; g.fillText(r.s, W / 2, yy); g.textAlign = 'left'; }
      else if (r.type === 'lr' || r.type === 'lr2') {
        g.fillStyle = r.type === 'lr2' ? '#57555f' : '#26252c';
        g.font = r.type === 'lr2' ? F2 : F; g.textAlign = 'left'; g.fillText(r.l, PAD, yy);
        if (r.r) { g.textAlign = 'right'; g.fillText(r.r, W - PAD, yy); g.textAlign = 'left'; }
      }
      yy += r.h;
    }
    const moreM = hidden.reduce((s, id) => s + monthC(id), 0);
    const moreA = hidden.reduce((s, id) => s + yearC(id) - monthC(id) * 12, 0);
    cv.dataset.lines = shown.length; cv.dataset.hidden = hidden.length; cv.dataset.overflow = yy > H - BOT + 1 ? '1' : '';
    cv.dataset.month = m; cv.dataset.year = y; cv.dataset.life = life; cv.dataset.annual = a;
    cv.dataset.moreMonth = moreM; cv.dataset.moreYear = moreA;
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
