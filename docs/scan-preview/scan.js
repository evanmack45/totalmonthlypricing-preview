// Total Monthly Pricing, scan layout (preview at /scan-preview/). Same data, math, hash and share card as app.js.
// The data/math/hash block and drawReceipt() are copied from app.js unchanged (image paths point one folder up).
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

  const $$ = (s) => [...document.querySelectorAll(s)];
  const tiles = $$('.tile'), wraps = $$('.tw'), chips = $$('.chip');
  const catOf = new Map(wraps.map((w) => [w.dataset.id, w.dataset.cat]));
  let touched = false;
  const isExample = () => age === 30 && data.example.length === sel.size && data.example.every((id) => sel.has(id) && sel.get(id) == null);

  // ---------- totals ----------
  const render = () => {
    const { m, y, a, life } = sums();
    $('#t-month').textContent = usd(m);
    const ann = $('#t-annual'); ann.hidden = !a; ann.textContent = a ? `+ ${usd(a)} a year` : '';
    $('#t-life').textContent = usd(life);
    $('#t-day').textContent = usd(Math.round(y / 365.25));
    // "Example" only until the first tap; after that the bar says how many are theirs.
    const ex = !touched && isExample();
    $('#t-example').hidden = !ex;
    const cnt = $('#t-count'); cnt.hidden = ex || !sel.size; cnt.textContent = `${sel.size} picked`;
    for (const t of tiles) {
      const id = t.dataset.id, it = byId.get(id);
      t.setAttribute('aria-pressed', String(sel.has(id)));
      t.querySelector('.t-price').textContent = usd(sel.has(id) ? priceC(id) : cents(it.price)) + per(it.per);
      t.classList.toggle('own', sel.get(id) != null);
    }
    for (const c of chips) {
      const k = c.dataset.cat;
      const n = k === 'all' ? 0 : k === 'picked' ? sel.size : k === 'popular' ? [...sel.keys()].filter((id) => popular.has(id)).length : [...sel.keys()].filter((id) => catOf.get(id) === k).length;
      c.querySelector('.n').textContent = n ? String(n) : '';
    }
    $('#clear').hidden = !sel.size;
    if (cur === 'picked') $('#none-picked').hidden = sel.size > 0;
    afterRender();
  };
  const bump = () => { if (reduced) return; const g = $('#t-life'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); };

  // ---------- filters ----------
  let cur = 'popular';
  const popular = new Set(data.popular);
  // The grid order is fixed in the HTML (Popular ranking first); chips only show and hide tiles.
  const show = (c) => {
    cur = c;
    for (const b of chips) b.setAttribute('aria-pressed', String(b.dataset.cat === c));
    for (const w of wraps) w.hidden = !(c === 'all' || (c === 'picked' ? sel.has(w.dataset.id) : c === 'popular' ? popular.has(w.dataset.id) : w.dataset.cat === c));
    $('#none-picked').hidden = !(c === 'picked' && !sel.size);
  };
  $('#chips').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) show(b.dataset.cat); });
  // Edge fades on the chip row show there is more to scroll; each fade goes away at its end.
  const chipRow = $('#chips');
  const fade = () => {
    const more = chipRow.scrollWidth - chipRow.clientWidth - chipRow.scrollLeft;
    chipRow.style.setProperty('--fl', chipRow.scrollLeft > 4 ? '40px' : '0px');
    chipRow.style.setProperty('--fr', more > 4 ? '56px' : '0px');
    chipRow.dataset.more = more > 4 ? 'right' : '';
  };
  chipRow.addEventListener('scroll', fade, { passive: true });
  addEventListener('resize', fade, { passive: true });
  fade(); document.fonts.ready.then(fade);

  // ---------- tiles ----------
  const swapNote = $('#swap-note');
  $('#tiles').addEventListener('click', (e) => {
    const t = e.target.closest('.tile'); if (!t) return;
    touched = true;
    const id = t.dataset.id; let swapped = null;
    if (sel.has(id)) sel.delete(id);
    else { for (const s of sibsOf(id)) if (sel.has(s)) { swapped = s; sel.delete(s); } sel.set(id, null); }
    const it = byId.get(id);
    swapNote.textContent = swapped ? `${it.service}: switched from ${byId.get(swapped).plan} to ${it.plan}. One plan per service.` : '';
    render(); writeHash(); bump();
  });
  $('#clear').addEventListener('click', () => { touched = true; sel.clear(); render(); writeHash(); if (cur === 'picked') show('picked'); $('#tiles .tile')?.focus(); });
  const ageIn = $('#age');
  ageIn.addEventListener('input', () => { const a = Number(ageIn.value); if (!ageIn.value || !Number.isFinite(a)) return; age = clampAge(a); render(); writeHash(); });
  ageIn.addEventListener('blur', () => { ageIn.value = age; });

  // Header "Sources" jumps to the full list and opens it.
  const allPrices = $('#all-prices');
  const openPrices = () => { allPrices.open = true; };
  $('#src-link').addEventListener('click', openPrices);
  if (location.hash === '#all-prices') openPrices();

  // ---------- share (same flow as app.js; the panel is a dialog with the card) ----------
  const CANONICAL = 'https://totalmonthlypricing.com/';
  // The preview shares and links the real home page, never /scan-preview/.
  const publicPage = () => CANONICAL;
  const publicLink = (hash) => `${publicPage()}${hash && hash !== '#' ? (hash.startsWith('#') ? hash : '#' + hash) : ''}`;
  const publicFooter = (hash) => publicLink(hash).replace(/^https?:\/\//, '');
  const msg = $('#share-msg');
  const say = (s) => { msg.textContent = s; clearTimeout(say.t); say.t = setTimeout(() => (msg.textContent = ''), 4000); };
  const shareBtn = $('#sharebtn'), dlg = $('#share-dlg'), xLink = $('#x-post'), copyBtn = $('#share'), saveBtn = $('#save'), img = $('#share-img');
  const SHARE_REF = '?ref=share';
  const shareUrl = () => `${publicPage()}${SHARE_REF}`;
  const shareText = () => {
    const { m, y, a, life } = sums();
    const cost = m ? `${usd(m)} a month${a ? ` plus ${usd(a)} a year` : ''}` : `${usd(y)} a year`;
    return `My subscriptions cost ${cost}. That is ${usd(life)} by age ${END}. What does yours add up to?`;
  };
  const syncShare = () => {
    const any = sel.size > 0;
    shareBtn.disabled = !any;
    shareBtn.textContent = any ? 'Share' : 'Tap a service';
    xLink.href = `https://x.com/intent/post?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(shareUrl())}`;
  };
  let shareFile = null, shareKey = '', armed = false;
  const buildShare = async () => {
    const key = toHash();
    const cv = await drawReceipt();
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    if (!blob) throw new Error('image not made');
    const file = new File([blob], `receipt-to-age-${END}.png`, { type: 'image/png' });
    if (key === toHash()) { shareFile = file; shareKey = key; }
    return file;
  };
  const freshFile = () => (shareFile && shareKey === toHash() ? shareFile : null);
  const prep = () => { clearTimeout(prep.t); if (armed && sel.size) prep.t = setTimeout(() => buildShare().catch(() => {}), 400); };
  const arm = () => { if (!armed) { armed = true; prep(); } };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, arm, { once: true, passive: true });
  const afterRender = () => { syncShare(); prep(); };
  let imgUrl = '';
  const openDlg = async () => {
    dlg.showModal();
    try { const f = freshFile() || await buildShare(); URL.revokeObjectURL(imgUrl); imgUrl = URL.createObjectURL(f); img.src = imgUrl; } catch { say('Could not make the image. Try again.'); }
  };
  shareBtn.addEventListener('click', async () => {
    if (!sel.size) return;
    history.replaceState(null, '', toHash());
    if (matchMedia('(pointer: coarse)').matches && typeof navigator.share === 'function') {
      try {
        const file = freshFile() || await buildShare();
        const base = { url: shareUrl(), text: shareText() };
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], ...base });
        else await navigator.share(base);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // the person closed the sheet
      }
    }
    openDlg();
  });
  saveBtn.addEventListener('click', async () => {
    let file;
    try { file = freshFile() || await buildShare(); } catch { say('Could not make the image. Try again.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say('Image saved.');
  });
  copyBtn.addEventListener('click', async () => {
    history.replaceState(null, '', toHash());
    const url = publicLink(toHash());
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = 'Copied'; copyBtn.dataset.state = 'copied';
      clearTimeout(copyBtn.t); copyBtn.t = setTimeout(() => { copyBtn.textContent = 'Copy link'; delete copyBtn.dataset.state; }, 2500);
      say('Link copied. It holds your picks, nothing else.');
    } catch { say('Copy this link: ' + url); }
  });
  xLink.addEventListener('click', () => { history.replaceState(null, '', toHash()); });

  // Share image: a 4:5 card, 1080x1350. Hero number, the 5 costliest lines that fit, "+N more" with its
  // monthly sum, totals, and the canonical URL. Every shown line keeps its source host; the footer points at
  // the page where all 58 sources are listed.
  const SHARE_W = 540, SHARE_H = 675, SHARE_MAX_LINES = 5;
  // opts.hideZeroMonthly: drop the "TOTAL MONTHLY $0.00" line when nothing monthly is picked (one-off assets only;
  // the Share card always calls drawReceipt() with no options, so it matches the home page).
  const drawReceipt = async (opts = {}) => {
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
    const tailA = [DASH(), ...(opts.hideZeroMonthly && !m ? [] : [row('lr', { l: 'TOTAL MONTHLY', r: usd(m) })]), ...(a ? [row('lr', { l: 'YEARLY PLANS', r: usd(a) })] : []), row('lr', { l: 'TOTAL YEARLY', r: usd(y) })];
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
      const perf = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = '../img/perforation.webp'; });
      g.drawImage(perf, 0, Math.floor(perf.height * 0.35), perf.width, Math.floor(perf.height * 0.3), 0, 0, W, 14);
    } catch { /* decorative; receipt still prints without it */ }
    try {
      const ring = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = '../img/coffee-ring.webp'; });
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
    cv.dataset.monthlyLine = opts.hideZeroMonthly && !m ? '' : '1'; cv.dataset.month = m; cv.dataset.year = y; cv.dataset.life = life; cv.dataset.annual = a;
    cv.dataset.moreMonth = moreM; cv.dataset.moreYear = moreA;
    return cv;
  };
  window.__receipt = drawReceipt;

  // ---------- start ----------
  if (readHash()) touched = true; else { sel.clear(); for (const id of data.example) sel.set(id, null); }
  ageIn.value = age;
  render();
  addEventListener('hashchange', () => { if (readHash()) { touched = true; ageIn.value = age; render(); } });
})();
