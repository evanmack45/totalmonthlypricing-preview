// Builds docs/ from ../data/prices.json. No dependencies.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'docs');
const data = JSON.parse(readFileSync(join(here, 'data/prices.json'), 'utf8'));
const SITE = 'https://evanmack45.github.io/totalmonthlypricing-preview/';
const AFTERNIC = 'https://www.afternic.com/domain/totalmonthlypricing.com';
export const EXAMPLE = ['netflix-std', 'spotify', 'icloud-200'];

// Boundary checks: bad data fails the build instead of printing a wrong receipt.
const ids = new Set();
for (const it of data.items) {
  for (const k of ['id', 'service', 'plan', 'group', 'price', 'per', 'source', 'checked'])
    if (it[k] === undefined || it[k] === '') throw new Error(`${it.id}: missing ${k}`);
  if (ids.has(it.id)) throw new Error(`duplicate id ${it.id}`);
  ids.add(it.id);
  if (!/^[a-z0-9-]+$/.test(it.id)) throw new Error(`${it.id}: bad id`);
  if (!(typeof it.price === 'number' && it.price > 0 && it.price < 10000)) throw new Error(`${it.id}: bad price`);
  if (!['month', 'year'].includes(it.per)) throw new Error(`${it.id}: bad per`);
  if (!/^https:\/\//.test(it.source)) throw new Error(`${it.id}: bad source`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(it.checked)) throw new Error(`${it.id}: bad date`);
  if (it.then && !/^https:\/\//.test(it.then.url)) throw new Error(`${it.id}: bad then url`);
}
for (const id of EXAMPLE) if (!ids.has(id)) throw new Error(`example ${id} missing`);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d) => { const [y, m, day] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${day}, ${y}`; };
const host = (u) => new URL(u).hostname.replace(/^www\./, '');
const perLabel = (p) => (p === 'month' ? '/mo' : '/yr');
const dates = [...new Set(data.items.map((i) => i.checked))].sort();
const asOf = dates.length === 1 ? fmtDate(dates[0]) : `${fmtDate(dates[0])} to ${fmtDate(dates.at(-1))}`;
const short = (d) => { const [y, m, day] = d.split('-'); return `${m}/${day}/${y.slice(2)}`; };

const groups = [];
for (const it of data.items) {
  let g = groups.find((x) => x.name === it.group);
  if (!g) groups.push((g = { name: it.group, items: [] }));
  g.items.push(it);
}

const pickHTML = groups.map((g) => `
<fieldset class="group"><legend>${esc(g.name)}</legend><ul>
${g.items.map((it) => `<li class="pick" data-id="${it.id}" data-q="${esc((it.service + ' ' + it.plan).toLowerCase())}">
 <label><input type="checkbox" value="${it.id}"${EXAMPLE.includes(it.id) ? ' checked' : ''}><span class="pk-name">${esc(it.service)}</span> <span class="pk-plan">${esc(it.plan)}</span></label>
 <span class="pk-list">${usd(it.price)}${perLabel(it.per)}</span>
 <label class="pk-edit"><span>You pay</span> <span class="pk-cur">$</span><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="8" placeholder="${it.price.toFixed(2)}" aria-label="What you pay for ${esc(it.service)} ${esc(it.plan)}, per ${it.per}"><span class="pk-per">${perLabel(it.per)}</span></label>
</li>`).join('\n')}
</ul></fieldset>`).join('\n');

const tableHTML = groups.map((g) => g.items.map((it) => `<tr><td>${esc(it.service)}</td><td>${esc(it.plan)}</td><td class="num">${usd(it.price)}${perLabel(it.per)}</td><td><a href="${esc(it.source)}" rel="noopener">${esc(host(it.source))}</a></td><td>${fmtDate(it.checked)}</td><td>${it.note ? esc(it.note) : ''}${it.then ? `${it.note ? ' ' : ''}In ${it.then.year}: <a href="${esc(it.then.url)}" rel="noopener">${usd(it.then.price)}${perLabel(it.then.per)}</a>.` : ''}</td></tr>`).join('\n')).join('\n');

// Static receipt for the example basket, so the page has its hero without JS.
const AGE = 30, END = 80;
const monthly = (it) => (it.per === 'month' ? it.price : it.price / 12);
const ex = EXAMPLE.map((id) => data.items.find((i) => i.id === id));
const exMonthly = ex.reduce((s, it) => s + monthly(it), 0);
const lineHTML = (it, price = it.price) => `<li class="ln" data-id="${it.id}">
<div class="ln-top"><span class="ln-name">${esc(it.service)} ${esc(it.plan)}</span><span class="ln-price">${usd(price)}${perLabel(it.per)}</span></div>
<div class="ln-life"><span>to age ${END}</span><span>${usd((it.per === 'month' ? price * 12 : price) * (END - AGE))}</span></div>
${it.then ? `<div class="ln-then">In ${it.then.year}: <a href="${esc(it.then.url)}" rel="noopener">${usd(it.then.price)}${perLabel(it.then.per)}</a></div>` : ''}
<div class="ln-src">src <a href="${esc(it.source)}" rel="noopener">${esc(host(it.source))}</a> ${short(it.checked)}</div>
</li>`;

const barcode = () => {
  let x = 0, seed = 7, rects = '';
  while (x < 300) { seed = (seed * 9301 + 49297) % 233280; const w = 1 + (seed % 4); rects += `<rect x="${x}" width="${w}" height="52"/>`; x += w + 1 + (seed % 3); }
  return `<svg class="barcode" viewBox="0 0 ${x} 52" preserveAspectRatio="none" aria-hidden="true" focusable="false">${rects}</svg>`;
};
const receiptHTML = `
<div class="slot" aria-hidden="true"></div>
<article class="receipt" id="receipt" aria-labelledby="r-title">
 <header class="r-head">
  <p class="r-store" id="r-title">Total Monthly Pricing</p>
  <p>Receipt for one life</p>
  <p>Prices as of <span id="r-asof">${asOf}</span></p>
  <p class="r-age">Age <span id="r-age">${AGE}</span> to ${END} (<span id="r-years">${END - AGE}</span> years)</p>
 </header>
 <div class="r-due">
  <p class="r-due-k">To age ${END}</p>
  <p class="r-due-amt" id="t-life">${usd(exMonthly * 12 * (END - AGE))}</p>
  <p class="r-due-day">That is <span id="t-day">${usd(exMonthly * 12 / 365.25)}</span> a day, every day.</p>
 </div>
 <p class="r-tick" aria-live="off"><span>Since you got here</span><span id="r-tick">$0.000000</span></p>
 <ol class="r-lines" id="r-lines">${ex.map((it) => lineHTML(it)).join('')}</ol>
 <p class="r-empty" id="r-empty" hidden>Nothing ticked yet. Pick what you pay for.</p>
 <dl class="r-tot">
  <div><dt>Total monthly</dt><dd id="t-month">${usd(exMonthly)}</dd></div>
  <div><dt>Total yearly</dt><dd id="t-year">${usd(exMonthly * 12)}</dd></div>
 </dl>
 <p class="r-fine">Today's list prices, held flat. Real prices tend to rise. Taxes not included.</p>
 ${barcode()}
 <p class="r-thanks">Thank you for subscribing</p>
</article>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Total Monthly Pricing: what your subscriptions cost for life</title>
<meta name="description" content="Tick the subscriptions you pay. A receipt prints your monthly total and what you will pay each company by age 80. Every price links its source.">
<meta property="og:title" content="Your subscriptions, printed for life">
<meta property="og:description" content="Tick what you pay. Get the receipt. Every price links its source.">
<meta property="og:image" content="${SITE}og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="A single white receipt curling in a loop on a mint-green backdrop with a coral stamp circle.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" as="image" href="img/hero.webp" imagesrcset="img/hero-800.webp 800w, img/hero.webp 1280w, img/hero-1920.webp 1920w" imagesizes="100vw">
<link rel="preload" href="fonts/instrument.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/departure.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="style.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect x='3' y='1' width='10' height='14' fill='%23fffdf6'/%3E%3Cpath d='M5 5h6M5 8h6M5 11h4' stroke='%23222' /%3E%3C/svg%3E">
<script>document.documentElement.className='js'</script>
</head>
<body>
<header class="bar"><a class="mark" href="./">Total Monthly Pricing</a><nav aria-label="Page"><a href="#prices">Prices and sources</a></nav></header>
<div class="mast">
 <img class="mast-art" src="img/hero.webp" srcset="img/hero-800.webp 800w, img/hero.webp 1280w, img/hero-1920.webp 1920w" sizes="100vw" width="1280" height="714" alt="A long pale-pink receipt paper roll unwinding along a diner counter toward a checkerboard floor, warm wood and stools behind." fetchpriority="high" decoding="async">
</div>
<main>
<section class="hero" aria-labelledby="h1">
 <div class="intro">
  <h1 id="h1">Your subscriptions, printed for life</h1>
  <p class="dek">Tick what you pay. The receipt adds it up to age 80.</p>
 </div>
 <div class="printer">${receiptHTML}
  <div class="r-actions">
   <button type="button" id="save">Save receipt image</button>
   <button type="button" id="share">Copy link</button>
   <span id="share-msg" role="status"></span>
  </div>
 </div>
 <form class="picker" id="picker" aria-labelledby="pick-h" onsubmit="return false">
  <h2 id="pick-h">What do you pay for?</h2>
  <div class="controls">
   <label class="age"><span>Your age</span><input id="age" type="number" inputmode="numeric" min="13" max="79" value="${AGE}"></label>
   <label class="find"><span>Find</span><input id="find" type="search" autocomplete="off" placeholder="Netflix, iCloud, Xbox..."></label>
  </div>
  <p class="hint" id="hint">Three common ones are ticked to start. Untick them, tick yours. Change a price if you pay something else. Nothing leaves your browser.</p>
  <noscript><p class="hint">The receipt needs JavaScript to add up your own picks. The full price list below works without it.</p></noscript>
  <p class="nomatch" id="nomatch" hidden>No subscription matches that. Try a company name.</p>
  ${pickHTML}
 </form>
</section>
<img class="perf-band" src="img/perforation.webp" srcset="img/perforation-800.webp 800w, img/perforation.webp 1280w" sizes="100vw" width="1280" height="182" alt="A strip of mint-green sprocket-hole paper edge with a dotted tear line on cream stock." loading="lazy" decoding="async">

<section class="prices" id="prices" aria-labelledby="prices-h">
 <h2 id="prices-h">Prices and sources</h2>
 <p>${data.items.length} US list prices from ${data.items.length && new Set(data.items.map((i) => i.service)).size} services. Each one comes from the company's own pricing or help page, checked ${asOf}. ${esc(data.method)}</p>
 <div class="tablewrap" tabindex="0" role="region" aria-labelledby="prices-h">
 <table>
  <thead><tr><th scope="col">Service</th><th scope="col">Plan</th><th scope="col" class="num">Price</th><th scope="col">Source</th><th scope="col">Checked</th><th scope="col">Notes</th></tr></thead>
  <tbody>${tableHTML}</tbody>
 </table>
 </div>
 <p>Found a wrong price? The data is one file, <a href="data/prices.json">prices.json</a>, with the source and date for every row.</p>
</section>

<section class="about" aria-labelledby="about-h">
 <h2 id="about-h">How the math works</h2>
 <p>Monthly plans count 12 times a year. Yearly plans count once. The total to age 80 multiplies one year by the years you have left, at today's price. That is a floor, since most of these prices have gone up over time. The older prices on the receipt show how much.</p>
 <p>This page has no accounts, no cookies, no tracking and no ads. Your picks live in the page and, if you copy the link, in the link itself.</p>
</section>
</main>
<a class="peek" id="peek" href="#receipt" hidden><span><b id="peek-month"></b> a month</span><span><b id="peek-life"></b> to age ${END}</span><span class="peek-go">See receipt</span></a>
<footer class="foot"><p><a href="${AFTERNIC}" rel="noopener">This domain is for sale.</a></p></footer>
<script type="application/json" id="data">${JSON.stringify({ asOf, end: END, example: EXAMPLE, items: data.items.map(({ id, service, plan, price, per, source, checked, then }) => ({ id, service, plan, price, per, source, checked, then })) }).replace(/</g, '\\u003c')}</script>
<script src="app.js" defer></script>
</body>
</html>`;

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'fonts'), { recursive: true });
mkdirSync(join(out, 'data'), { recursive: true });
writeFileSync(join(out, 'index.html'), html);
for (const f of ['style.css', 'app.js']) copyFileSync(join(here, 'src', f), join(out, f));
mkdirSync(join(out, 'img'), { recursive: true });
for (const f of readdirSync(join(here, 'src/img'))) copyFileSync(join(here, 'src/img', f), join(out, 'img', f));
copyFileSync(join(here, 'src/img/og.jpg'), join(out, 'og.jpg'));
for (const f of readdirSync(join(here, 'src/fonts'))) copyFileSync(join(here, 'src/fonts', f), join(out, 'fonts', f));
copyFileSync(join(here, 'data/prices.json'), join(out, 'data/prices.json'));
writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(out, '.nojekyll'), '');
console.log(`built ${out}: ${data.items.length} prices, ${groups.length} groups, as of ${asOf}`);
