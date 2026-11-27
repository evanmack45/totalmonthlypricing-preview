// Total Monthly Pricing home page (scan layout). Same data, math and share hash format as the old home app.js,
// so old share links (#p=id,id~price&age=N) still load.
// The data/math/hash block is copied from app.js unchanged. drawReceipt() is the lean v4 card (names, prices, one
// total); the home page's card follows it at promotion.
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
  let touched = false;
  const isExample = () => age === 30 && data.example.length === sel.size && data.example.every((id) => sel.has(id) && sel.get(id) == null);

  // ---------- totals ----------
  const render = () => {
    const { m, y, a, life } = sums();
    $('#t-month').textContent = usd(m);
    const ann = $('#t-annual'); ann.hidden = !a; ann.textContent = a ? `+ ${usd(a)} a year` : '';
    $('#t-life').textContent = usd(life);
    $('#t-day').textContent = usd(Math.round(y / 365.25));
    // The starting basket carries no label (Dash 11/27: no EXAMPLE on the money). After the first tap the bar says how many are theirs.
    const ex = !touched && isExample();
    $('#total').toggleAttribute('data-start', ex);
    const cnt = $('#t-count'); cnt.hidden = ex || !sel.size; cnt.textContent = `${sel.size} picked`;
    for (const t of tiles) {
      const id = t.dataset.id, it = byId.get(id);
      t.setAttribute('aria-pressed', String(sel.has(id)));
      t.querySelector('.t-price').textContent = usd(sel.has(id) ? priceC(id) : cents(it.price)) + per(it.per);
      t.classList.toggle('own', sel.get(id) != null);
    }
    for (const c of chips) {
      const k = c.dataset.cat;
      // Only Picked carries a count (Dash 11/27: 'Start here 3' pushed Music off a 390px row); the tiles' check pips show the rest.
      const n = k === 'picked' ? sel.size : 0;
      c.querySelector('.n').textContent = n ? String(n) : '';
    }
    $('#clear').hidden = !sel.size;
    $('#total').toggleAttribute('data-empty', !sel.size);
    $('#t-hint').hidden = sel.size > 0;
    if (cur === 'picked') $('#none-picked').hidden = sel.size > 0;
    afterRender();
  };
  const bump = () => { if (reduced) return; const g = $('#t-life'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); };

  // ---------- filters ----------
  let cur = 'start';
  const starter = new Set(data.start);
  // The grid order is fixed in the HTML (the Start here set first); chips only show and hide tiles.
  const show = (c) => {
    cur = c;
    for (const b of chips) b.setAttribute('aria-pressed', String(b.dataset.cat === c));
    for (const w of wraps) w.hidden = !(c === 'all' || (c === 'picked' ? sel.has(w.dataset.id) : c === 'start' ? starter.has(w.dataset.id) : w.dataset.cat === c));
    $('#none-picked').hidden = !(c === 'picked' && !sel.size);
  };
  // Picked with nothing picked would be an empty grid; show Start here instead.
  const pick = (c) => (c === 'picked' && !sel.size ? 'start' : c);
  $('#chips').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) show(pick(b.dataset.cat)); });
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
    if (cur === 'picked' && !sel.size) toStart();
  });
  // Clear all never leaves an empty grid: back to Start here, chip row scrolled to its start, $0 and a one-line hint in the bar.
  const toStart = () => { show('start'); chipRow.scrollTo({ left: 0, behavior: reduced ? 'auto' : 'smooth' }); };
  $('#clear').addEventListener('click', () => { touched = true; sel.clear(); swapNote.textContent = ''; render(); writeHash(); toStart(); $('.tw:not([hidden]) .tile')?.focus(); });
  const ageIn = $('#age');
  ageIn.addEventListener('input', () => { const a = Number(ageIn.value); if (!ageIn.value || !Number.isFinite(a)) return; age = clampAge(a); render(); writeHash(); });
  ageIn.addEventListener('blur', () => { ageIn.value = age; });

  // Header "Sources" jumps to the full list and opens it.
  const allPrices = $('#all-prices');
  const openPrices = () => { allPrices.open = true; };
  $('#src-link').addEventListener('click', openPrices);
  if (location.hash === '#all-prices' || location.hash === '#prices') openPrices(); // #prices: the old home's anchor

  // ---------- share (same flow as app.js; the panel is a dialog with the card) ----------
  const CANONICAL = 'https://totalmonthlypricing.com/';
  // Shares and links always point at the canonical home, never localhost.
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
    xLink.href = `https://x.com/intent/post?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(shareUrl())}`;
  };
  let shareFile = null, shareKey = '', armed = false;
  const buildShare = async () => {
    const key = toHash();
    const cv = await drawReceipt({ hideZeroMonthly: true });
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

  // Share image: a 4:5 card, 1080x1350. The 5 costliest lines that fit (name, plan, list price, subtotal to END),
  // "+N more" with its monthly sum, one total, then one footer line: price date and the canonical URL, where all
  // 58 sources are listed.
  const SHARE_W = 540, SHARE_H = 675, SHARE_MAX_LINES = 5;
  // opts.hideZeroMonthly: drop "$0.00 a month" under the total when nothing monthly is picked (yearly-only picks
  // read "$139.00 a year", not "$0.00 a month + $139.00 a year"). The Share card always sets it.
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

    // one shown line = 2 rows (name + price, then subtotal to END), plus "your price" when it was edited
    const lineRows = (id, withThen) => {
      const it = byId.get(id); const p = priceC(id); const yv = yearC(id);
      const pr = usd(p) + per(it.per);
      const out = [];
      wrap(`${it.service} ${it.plan}`, cols - pr.length - 1).forEach((n, i) => out.push(row('lr', { l: n, r: i === 0 ? pr : '' })));
      out.push(row('lr2', { l: `  to ${END}`, r: usd(yv * (END - age)) }));
      if (sel.get(id) != null) out.push(row('lr2', { l: `  your price, list ${usd(cents(it.price))}` }));
      out.push(row('gap', { gap: 6 }));
      return out;
    };
    const sum = (rs) => rs.reduce((s, r) => s + r.h, 0);

    // Lean card (v4 critique #8): names, prices, one total. No motto, no source hosts, no history asides;
    // the sources live on the page the footer names.
    const head = [...C('TOTAL MONTHLY PRICING'), ...C(`Age ${age} to ${END}`), DASH()];
    const foot = publicFooter('').replace(/#$/, '').replace(/\/$/, '');
    const urlRows = [];
    const rate = [...(opts.hideZeroMonthly && !m ? [] : [`${usd(m)} a month`]), ...(a ? [`${usd(a)} a year`] : [])].join(' + ');
    const tailA = [DASH(), row('hero', { kicker: 'TOTAL TO AGE ' + END, amount: lifeTxt, sub: rate })];
    const tailB = [DASH(), ...C(`List prices, ${data.asOf}`), ...C(foot)];
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
    const decor = [row('bar')];
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
    cv.dataset.text = rows.filter((r) => r.type === 'c' || r.type === 'lr' || r.type === 'lr2' || r.type === 'hero').map((r) => r.type === 'hero' ? [r.kicker, r.amount, r.sub].join(' | ') : [r.s ?? r.l, r.r].filter(Boolean).join(' | ')).join('\n');
    return cv;
  };
  window.__receipt = drawReceipt;

  // ---------- start ----------
  // Land where every pick is on screen: Start here when it holds them all (the example basket does), else Picked.
  // Never a single category, so a shared link can't open on TV with its other picks hidden.
  const land = () => {
    show(!sel.size || [...sel.keys()].every((id) => starter.has(id)) ? 'start' : 'picked');
    const on = $('.chip[aria-pressed=true]'); chipRow.scrollLeft = on.offsetLeft - chipRow.offsetLeft - 16; fade();
  };
  if (readHash()) touched = true; else { sel.clear(); for (const id of data.example) sel.set(id, null); }
  ageIn.value = age;
  render(); land();
  addEventListener('hashchange', () => { if (readHash()) { touched = true; ageIn.value = age; render(); land(); } });
})();
