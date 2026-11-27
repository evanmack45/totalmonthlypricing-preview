// Builds docs/ from ../data/prices.json. No dependencies.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'docs');
const data = JSON.parse(readFileSync(join(here, 'data/prices.json'), 'utf8'));
const SITE = 'https://totalmonthlypricing.com/';
import { EXAMPLE_IDS } from './scripts/example.mjs';
export const EXAMPLE = EXAMPLE_IDS;
const PH = `${SITE}streaming-price-history/`;
const APP_LD = { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Total Monthly Pricing', url: SITE, description: 'Tick the subscriptions you pay. A receipt prints your monthly total and what you will pay each company by age 80. Every price links its source.', applicationCategory: 'FinanceApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } };
const ldTag = `<script type="application/ld+json">${JSON.stringify(APP_LD).replace(/</g, '\\u003c')}</script>`;

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
const cents = (n) => Math.round(Number(n) * 100);
const usdC = (c) => { const n = Math.round(c), sign = n < 0 ? '-' : '', a = Math.abs(n); return `${sign}$${Math.floor(a / 100).toLocaleString('en-US')}.${String(a % 100).padStart(2, '0')}`; };
const usd = (n) => usdC(cents(n));
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
const monthC = (it, price = it.price) => (it.per === 'month' ? cents(price) : 0);
const yearC = (it, price = it.price) => (it.per === 'month' ? cents(price) * 12 : cents(price));
const ex = EXAMPLE.map((id) => data.items.find((i) => i.id === id));
const exMonth = ex.reduce((s, it) => s + monthC(it), 0);
const exYear = ex.reduce((s, it) => s + yearC(it), 0);
const exLife = exYear * (END - AGE);
const lineHTML = (it, price = it.price) => `<li class="ln" data-id="${it.id}">
<div class="ln-top"><span class="ln-name">${esc(it.service)} ${esc(it.plan)}</span><span class="ln-price">${usd(price)}${perLabel(it.per)}</span></div>
<div class="ln-life"><span>to age ${END}</span><span>${usdC(yearC(it, price) * (END - AGE))}</span></div>
${it.then ? `<div class="ln-then">In ${it.then.year}: <a href="${esc(it.then.url)}" rel="noopener">${usd(it.then.price)}${perLabel(it.then.per)}</a></div>` : ''}
<div class="ln-src">src <a href="${esc(it.source)}" rel="noopener">${esc(host(it.source))}</a> ${short(it.checked)}</div>
</li>`;

const barcode = () => {
  let x = 0, seed = 7, rects = '';
  while (x < 300) { seed = (seed * 9301 + 49297) % 233280; const w = 1 + (seed % 4); rects += `<rect x="${x}" width="${w}" height="52"/>`; x += w + 1 + (seed % 3); }
  return `<svg class="barcode" viewBox="0 0 ${x} 52" preserveAspectRatio="none" aria-hidden="true" focusable="false">${rects}</svg>`;
};
// Home link-card image: scripts/make-og.mjs draws it from this build with the site's own drawReceipt().
const OG_HOME = 'og-receipt.png';
const OG_ALT = `A receipt on orange: ${ex.map((it) => `${it.service} ${it.plan}`).join(', ')} add up to ${usdC(exLife)} from age ${AGE} to ${END}, or ${usdC(Math.round(exYear / 365.25))} a day.`;
const receiptHTML = `
<article class="receipt" id="receipt" aria-labelledby="r-title">
 <img class="r-stain" src="img/coffee-ring-400.webp" width="400" height="400" alt="" decoding="async" aria-hidden="true">
 <header class="r-head">
  <p class="r-store" id="r-title">Total Monthly Pricing</p>
  <p>Receipt for one life</p>
  <p>Prices as of <span id="r-asof">${asOf}</span></p>
  <p class="r-age">Age <span id="r-age">${AGE}</span> to ${END} (<span id="r-years">${END - AGE}</span> years)</p>
  <p class="r-example" id="r-example">Example basket. Tick what you pay for.</p>
 </header>
 <div class="r-due">
  <p class="r-due-k">To age ${END}</p>
  <p class="r-due-amt" id="t-life">${usdC(exLife)}</p>
  <p class="r-due-day">That is <span id="t-day">${usdC(Math.round(exYear / 365.25))}</span> a day, every day.</p>
  <div class="r-actions">
   <button type="button" id="sharebtn" class="share-main" aria-expanded="false" aria-controls="share-panel">Share receipt</button>
   <p id="share-note" class="share-note" hidden>Tick a subscription to share your receipt.</p>
   <div id="share-panel" class="share-panel" role="group" aria-label="Share your receipt" hidden>
    <a id="x-post" class="btn" href="https://x.com/intent/post" target="_blank" rel="noopener noreferrer">Post to X</a>
    <button type="button" id="save">Download image</button>
    <button type="button" id="share">Copy link</button>
    <p class="share-tip">Instagram: download the image, then add it to a story or post.</p>
   </div>
   <span id="share-msg" role="status"></span>
  </div>
 </div>
 <p class="r-tick" aria-live="off"><span>Since you got here</span><span id="r-tick">$0.000000</span></p>
 <ol class="r-lines" id="r-lines">${ex.map((it) => lineHTML(it)).join('')}</ol>
 <p class="r-empty" id="r-empty" hidden>Nothing ticked yet. Pick what you pay for.</p>
 <dl class="r-tot">
  <div><dt>Total monthly</dt><dd id="t-month">${usdC(exMonth)}</dd></div>
  <div id="t-annual-row" hidden><dt>Yearly plans</dt><dd id="t-annual">${usdC(0)}</dd></div>
  <div><dt>Total yearly</dt><dd id="t-year">${usdC(exYear)}</dd></div>
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
<link rel="canonical" href="${SITE}">
<meta property="og:url" content="${SITE}">
<title>Total Monthly Pricing: what your subscriptions cost for life</title>
<meta name="description" content="Tick the subscriptions you pay. A receipt prints your monthly total and what you will pay each company by age 80. Every price links its source.">
<meta property="og:title" content="Your subscriptions, printed for life">
<meta property="og:description" content="Tick what you pay. Get the receipt. Every price links its source.">
<meta property="og:image" content="${SITE}${OG_HOME}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(OG_ALT)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}${OG_HOME}">
<meta name="twitter:image:alt" content="${esc(OG_ALT)}">
<link rel="preload" as="image" media="(min-width: 900px)" href="img/hero.webp" imagesrcset="img/hero-800.webp 800w, img/hero.webp 1280w, img/hero-1920.webp 1920w" imagesizes="100vw">
${ldTag}
<link rel="preload" href="fonts/instrument.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/departure.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="style.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect x='3' y='1' width='10' height='14' fill='%23fffdf6'/%3E%3Cpath d='M5 5h6M5 8h6M5 11h4' stroke='%23222' /%3E%3C/svg%3E">
<script>document.documentElement.className='js'</script>
</head>
<body>
<header class="bar"><a class="mark" href="./">Total Monthly Pricing</a><nav aria-label="Page"><a href="#prices">Prices and sources</a> <a class="nav-launch" href="streaming-price-history/">Since launch</a></nav></header>
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
 </div>
 <form class="picker" id="picker" aria-labelledby="pick-h" onsubmit="return false">
  <h2 id="pick-h">What do you pay for?</h2>
  <div class="controls">
   <label class="age"><span>Your age</span><input id="age" type="number" inputmode="numeric" min="13" max="79" value="${AGE}"></label>
   <label class="find"><span>Find</span><input id="find" type="search" autocomplete="off" placeholder="Netflix, iCloud, Xbox..."></label>
  </div>
  <p class="hint" id="hint">A starter set is ticked. Untick it, tick yours. Your picks stay in your browser.</p>
  <noscript><p class="hint">The receipt needs JavaScript to add up your own picks. The full price list below works without it.</p></noscript>
  <p class="swap-note" id="swap-note" role="status"></p>
  <p class="nomatch" id="nomatch" hidden>No subscription matches that. Try a company name.</p>
  ${pickHTML}
 </form>
</section>


<section class="prices" id="prices" aria-labelledby="prices-h">
 <h2 id="prices-h">Prices and sources</h2>
 <p>${data.items.length} US list prices from ${data.items.length && new Set(data.items.map((i) => i.service)).size} services. Each comes from the company's own pricing or help page, checked ${asOf}. New US subscribers, before tax, with intro and student prices left out.</p>
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
 <p>Monthly plans count 12 times a year, yearly plans once. The total to age 80 multiplies one year by the years you have left, at today's price.</p>
 <p>This page has no accounts, cookies or ads. Your picks are not sent to us or to anyone else unless you share them. They live in the page, and in the link if you copy it.</p>
</section>
</main>
<a class="peek" id="peek" href="#receipt" hidden><span><b id="peek-month"></b></span><span><b id="peek-life"></b> to age ${END}</span><span class="peek-go">See receipt</span></a>
<footer class="foot"><p class="foot-launch"><a href="streaming-price-history/">Since launch</a></p></footer>
<script type="application/json" id="data">${JSON.stringify({ asOf, end: END, example: EXAMPLE, items: data.items.map(({ id, service, plan, price, per, source, checked, then }) => ({ id, service, plan, price, per, source, checked, then })) }).replace(/</g, '\\u003c')}</script>
<script src="app.js" defer></script>
</body>
</html>`;


const hist = data.items.filter((i) => i.then);
if (!hist.length) throw new Error('no sourced launch prices; cannot build /streaming-price-history/');
for (const it of hist) {
  const t = it.then;
  if (!(t && t.year && t.price > 0 && t.per && t.url && t.what)) throw new Error(`${it.id}: incomplete then`);
}
const phAnswer = 'Launch prices next to today\'s list prices. Every figure in the table links its source.';
if (phAnswer.trim().split(/\s+/).length > 60) throw new Error('history answer over 60 words');
const usdThen = (it) => usd(it.then.price) + perLabel(it.then.per);
const usdNow = (it) => usd(it.price) + perLabel(it.per);
const need = {
  'apple-tv': { then: 4.99, now: 14.99, year: 2019 },
  spotify: { then: 9.99, now: 12.99, year: 2011 },
  'gamepass-ess': { then: 9.99, now: 9.99, year: 2017 },
};
for (const [id, n] of Object.entries(need)) {
  const it = hist.find((x) => x.id === id);
  if (!it || it.then.price !== n.then || it.price !== n.now || it.then.year !== n.year) throw new Error(`history table data does not match expected sourced figures for ${id}`);
}
// Launch-source publication dates, fetched 2026-11-26 (America/Chicago) from each then.url.
// Never guessed: each date is datePublished / a visible dateline on the cited page.
// disney:     2019-11-12  JSON-LD datePublished 2019-11-12T14:00:02+00:00; visible "November 12, 2019"; title "Disney+ Launches Today".
// apple-tv:   2019-09-10  JSON-LD datePublished 2019-09-10Z; visible "PRESS RELEASE September 10, 2019".
// spotify:    2011-07-14  JSON-LD / article:published_time 2011-07-14T10:05:00Z (Billboard reprint).
// apple-music:2015-06-08  JSON-LD datePublished 2015-06-08Z.
// yt-premium: 2018-05-17  JSON-LD datePublished 2018-05-17T04:18:00+00:00.
// gamepass:   2017-02-28  JSON-LD / article:published_time 2017-02-28T14:00:24+00:00.
// prime:      2005-02-02  JSON-LD / article:published_time 2005-02-02T21:04:00Z.
// Disney+ today's "as of Sep 23, 2026" is from help.disneyplus.com ("prices are for new subscriptions as of September 23, 2026"), not the 2019 announcement. The Nov 25, 2026 line under the table is our recheck date.
const launchSourceOf = {
  'disney-ads': 'Walt Disney Company, Nov 12, 2019.',
  'disney-premium': 'Walt Disney Company, Nov 12, 2019.',
  'apple-tv': 'Apple Newsroom, Sep 10, 2019.',
  'spotify': 'Billboard, Jul 14, 2011.',
  'apple-music': 'Apple Newsroom, Jun 8, 2015.',
  'yt-premium': 'YouTube Blog, May 17, 2018.',
  'gamepass-ess': 'Xbox Wire, Feb 28, 2017.',
  'prime-year': 'Amazon, Feb 2, 2005.',
};
const todayAsOf = {
  'disney-ads': 'Sep 23, 2026',
  'disney-premium': 'Sep 23, 2026',
};
const phRows = hist.map((it) => {
  const asOfToday = todayAsOf[it.id];
  const todayCell = asOfToday
    ? `<a href="${esc(it.source)}" rel="noopener">${usdNow(it)}</a> <span class="price-asof">${esc(asOfToday)}</span>`
    : `<a href="${esc(it.source)}" rel="noopener">${usdNow(it)}</a>`;
  const launchSrc = launchSourceOf[it.id] || it.then.what;
  return `<tr>
  <th scope="row">${esc(it.service)}</th>
  <td data-label="Today's plan">${esc(it.plan)}</td>
  <td class="num" data-label="Today's price">${todayCell}</td>
  <td data-label="Launch year">${it.then.year}</td>
  <td class="num" data-label="Launch price"><a href="${esc(it.then.url)}" rel="noopener">${usdThen(it)}</a></td>
  <td data-label="Source">${esc(launchSrc)}</td>
</tr>`;
}).join('\n');
const PH_LD = { '@context': 'https://schema.org', '@type': 'WebPage', name: 'How much have streaming prices risen?', url: PH, description: phAnswer, isPartOf: { '@type': 'WebSite', name: 'Total Monthly Pricing', url: SITE } };
const phHTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${PH}">
<meta property="og:url" content="${PH}">
<title>How much have streaming prices risen? | Total Monthly Pricing</title>
<meta name="description" content="Launch prices and today's list prices for the plans in this list that have a sourced launch figure. Every number links its source.">
<meta property="og:title" content="How much have streaming prices risen?">
<meta property="og:description" content="Sourced launch prices next to today's list prices. Every figure links its source.">
<meta property="og:image" content="${SITE}og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="website">
<script type="application/ld+json">${JSON.stringify(PH_LD).replace(/</g, '\\u003c')}</script>
<link rel="preload" href="../fonts/instrument.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../fonts/departure.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../style.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect x='3' y='1' width='10' height='14' fill='%23fffdf6'/%3E%3Cpath d='M5 5h6M5 8h6M5 11h4' stroke='%23222' /%3E%3C/svg%3E">
</head>
<body class="hist-page">
<header class="bar"><a class="mark" href="../">Total Monthly Pricing</a><nav aria-label="Page"><a href="../">Back to the receipt</a></nav></header>
<main class="hist">
  <h1>How much have streaming prices risen?</h1>
  <p class="dek" id="ph-answer">${phAnswer}</p>
  <div class="hist-wrap">
  <table class="hist-table">
    <thead>
      <tr><th>Service</th><th>Plan</th><th>Today</th><th>Year</th><th>Launch</th><th>Source</th></tr>
    </thead>
    <tbody>
${phRows}
    </tbody>
  </table>
  </div>
  <p class="hist-asof">Today's prices were checked ${esc(asOf)}, for new US subscribers, before tax. Intro offers and student prices are left out.</p>
  <p class="hist-asof">A launch figure is shown only when this list has a sourced one. Some launches were one plan, so that figure is not a like-for-like match with every plan sold today.</p>
  <p class="hist-note">Disney+ launched as one plan. The <a href="${esc(hist.find((i) => i.id === 'disney-ads').then.url)}" rel="noopener">$6.99</a> figure is that launch price, not a 2019 ads or Premium tier.</p>
  <p class="hist-note">Xbox Game Pass also launched as one plan. Essential is the same dollar amount today. The full current list, with a source on every row, is on the <a href="../#prices">home page</a>.</p>
</main>
</body>
</html>`;


// ---------- /data/ : prices.csv + README page (Gizmo 11/26) ----------
// DATA_INDEXED is the one switch. false: the page carries <meta name="robots" content="noindex"> and is
// NOT in sitemap.xml. true: no noindex tag, and the page is in sitemap.xml. Nothing else changes.
// License is CC BY 4.0, approved by Evan (see /workspace/gizmo/t1-dataset.md).
const DATA_INDEXED = true; // Evan, via Dash, Thu 11/26/2026 1:25 PM CT: "yes, CC BY 4.0 for the T1 price data". Set false to go back to noindex + no sitemap entry.
const DATA = `${SITE}data/`;
const CSV_URL = `${DATA}prices.csv`;
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
const CSV_COLS = [
  ['id', 'Short ID. Same as the id in prices.json.'],
  ['service', 'Company or service name.'],
  ['plan', 'Plan name we use. Some names are shortened.'],
  ['group', 'Our category, such as TV or Games.'],
  ['price_usd', 'List price in US dollars, before tax. For new US subscribers.'],
  ['billing_period', 'month or year. A yearly price is never divided by 12.'],
  ['source_url', 'The company page the price was read from.'],
  ['checked', 'Date we last checked that page (YYYY-MM-DD).'],
  ['note', 'Short caveat, if the page had one. Often empty.'],
  ['launch_year', 'Year of the launch price. Empty if we have none.'],
  ['launch_price_usd', 'Launch price in US dollars. Empty if we have none.'],
  ['launch_billing_period', 'month or year, for the launch price.'],
  ['launch_source_url', 'Page that states the launch price.'],
];
const csvCell = (v) => { const t = v === undefined || v === null ? '' : String(v); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const csvRow = (it) => [it.id, it.service, it.plan, it.group, it.price.toFixed(2), it.per, it.source, it.checked, it.note || '',
  it.then ? it.then.year : '', it.then ? it.then.price.toFixed(2) : '', it.then ? it.then.per : '', it.then ? it.then.url : ''].map(csvCell).join(',');
const csvText = [CSV_COLS.map((c) => c[0]).join(','), ...data.items.map(csvRow)].join('\n') + '\n';
const lastChecked = dates.at(-1);
const nGroups = new Set(data.items.map((i) => i.group)).size;
const nLaunch = data.items.filter((i) => i.then).length;
const DATA_LD = {
  '@context': 'https://schema.org', '@type': 'Dataset',
  name: `US list prices for ${data.items.length} subscription plans`,
  description: `List prices in US dollars for ${data.items.length} subscription plans in ${nGroups} categories. Each row has the price, whether it bills monthly or yearly, the company page it came from, and the date we checked it. ${nLaunch} rows also have a sourced launch price.`,
  url: DATA, sameAs: SITE, license: LICENSE_URL, isAccessibleForFree: true, inLanguage: 'en',
  creator: { '@type': 'Organization', name: 'Total Monthly Pricing', url: SITE },
  keywords: ['subscription prices', 'streaming prices', 'list prices', 'USD'],
  dateModified: lastChecked, temporalCoverage: lastChecked, spatialCoverage: 'United States',
  measurementTechnique: 'Each current list price is read from the company\'s own page. A script re-fetches every source page and flags changes; a person updates the data file.',
  variableMeasured: CSV_COLS.map(([name, description]) => ({ '@type': 'PropertyValue', name, description })),
  distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: CSV_URL, name: 'prices.csv' }, { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${DATA}prices.json`, name: 'prices.json' }],
};
const previewRows = data.items.slice(0, 6).map((it) => `<li><span>${esc(it.service)} ${esc(it.plan)}</span><span>${usd(it.price)}${perLabel(it.per)}</span></li>`).join('\n   ');
const dataHTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${DATA_INDEXED ? '' : '<meta name="robots" content="noindex">\n'}<link rel="canonical" href="${DATA}">
<meta property="og:url" content="${DATA}">
<title>Subscription price data (CSV) | Total Monthly Pricing</title>
<meta name="description" content="US list prices for ${data.items.length} subscription plans as a CSV. Each row has its source page and check date. CC BY 4.0.">
<meta property="og:title" content="Subscription price data (CSV)">
<meta property="og:description" content="US list prices for ${data.items.length} subscription plans. Each row has its source page and check date.">
<meta property="og:image" content="${SITE}og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="website">
<script type="application/ld+json">${JSON.stringify(DATA_LD).replace(/</g, '\\u003c')}</script>
<link rel="preload" href="../fonts/instrument.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../fonts/departure.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../style.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect x='3' y='1' width='10' height='14' fill='%23fffdf6'/%3E%3Cpath d='M5 5h6M5 8h6M5 11h4' stroke='%23222' /%3E%3C/svg%3E">
</head>
<body class="data-page">
<header class="bar"><a class="mark" href="../">Total Monthly Pricing</a><nav aria-label="Page"><a href="../">Back to the receipt</a></nav></header>
<main class="hist">
  <h1>The price list, as a CSV</h1>
  <p class="dek" id="dp-lead">US list prices for ${data.items.length} plans, with the source page and check date for each.</p>
  <section class="dl-card" aria-label="Download">
   <p class="dl-name">prices.csv</p>
   <p class="dl-meta">${data.items.length} rows, ${CSV_COLS.length} columns, UTF-8</p>
   <ul class="dl-prev">
   ${previewRows}
   </ul>
   <p class="dl-go"><a class="btn dl-btn" href="prices.csv" download>Download prices.csv</a></p>
  </section>
  <h2>Columns</h2>
  <table class="col-table">
    <tbody>
${CSV_COLS.map(([n, d]) => `      <tr><th scope="row"><code>${n}</code></th><td>${esc(d)}</td></tr>`).join('\n')}
    </tbody>
  </table>
  <h2>Where the prices come from</h2>
  <p class="hist-note">Each current list price was read from the company's own page. We list new US subscriber prices before tax, and leave out intro offers and student prices.</p>
  <p class="hist-note">A script re-fetches every source page and flags changes. A person then updates the data file. We last checked on ${esc(fmtDate(lastChecked))}.</p>
  <p class="hist-note">Prices change. Treat each row as true on its check date.</p>
  <h2>License</h2>
  <p class="hist-note"><a href="${LICENSE_URL}" rel="license noopener">CC BY 4.0</a>. Please credit Total Monthly Pricing (totalmonthlypricing.com/data/).</p>
  <p class="hist-note">Some launch prices are for the first plan, not today's plans. Disney+ and Xbox Game Pass launched with one plan. The note for each is in prices.json, not in the CSV.</p>
         <p class="hist-note">The same data as JSON is in <a href="prices.json">prices.json</a>. The receipt that uses it is on the <a href="../">home page</a>.</p>
</main>
</body>
</html>`;

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'fonts'), { recursive: true });
mkdirSync(join(out, 'data'), { recursive: true });
writeFileSync(join(out, 'index.html'), html);
mkdirSync(join(out, 'streaming-price-history'), { recursive: true });
writeFileSync(join(out, 'streaming-price-history/index.html'), phHTML);
for (const f of ['style.css', 'app.js']) copyFileSync(join(here, 'src', f), join(out, f));
mkdirSync(join(out, 'img'), { recursive: true });
for (const f of readdirSync(join(here, 'src/img'))) copyFileSync(join(here, 'src/img', f), join(out, 'img', f));
copyFileSync(join(here, 'src/img/og.jpg'), join(out, 'og.jpg'));
try { copyFileSync(join(here, 'src', OG_HOME), join(out, OG_HOME)); } catch { console.warn(`no src/${OG_HOME} yet: run node scripts/make-og.mjs`); }
for (const f of readdirSync(join(here, 'src/fonts'))) copyFileSync(join(here, 'src/fonts', f), join(out, 'fonts', f));
copyFileSync(join(here, 'data/prices.json'), join(out, 'data/prices.json'));
writeFileSync(join(out, 'data/index.html'), dataHTML);
writeFileSync(join(out, 'data/prices.csv'), csvText);
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`);
writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[SITE, PH, ...(DATA_INDEXED ? [DATA] : [])].map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>\n`);
writeFileSync(join(out, 'CNAME'), 'totalmonthlypricing.com\n');
writeFileSync(join(out, '.nojekyll'), '');
console.log(`built ${out}: ${data.items.length} prices, ${groups.length} groups, as of ${asOf}`);
