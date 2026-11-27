// Scan layout preview (/scan-preview/): big tiles, one running total, sources one tap away.
// Same data file and the same math as the home page. Not linked, noindex, not in the sitemap.
export const SCAN_DIR = 'scan-preview';
// A few big filters, made from the groups already in prices.json.
const CATS = [
  ['tv', 'TV', ['TV', 'Live TV']],
  ['music', 'Music', ['Music & audio']],
  ['apps', 'Apps & AI', ['Storage & apps', 'AI']],
  ['games', 'Games', ['Games']],
  ['more', 'Shop & fitness', ['Shopping & delivery', 'Fitness & mind']],
];
export function scanPage({ data, SITE, AGE, END, EXAMPLE, asOf, esc, usd, usdC, perLabel, host, fmtDate, tableHTML, exMonth, exYear, exLife, OG_HOME, OG_ALT }) {
  const catOf = (it) => { const c = CATS.find(([, , gs]) => gs.includes(it.group)); if (!c) throw new Error(`${it.id}: group ${it.group} has no scan filter`); return c[0]; };
  const tile = (it) => `<div class="tw" data-id="${it.id}" data-cat="${catOf(it)}"${catOf(it) === 'tv' ? '' : ' hidden'}>
<button type="button" class="tile" data-id="${it.id}" aria-pressed="${EXAMPLE.includes(it.id)}"><span class="t-name">${esc(it.service)}</span><span class="t-plan">${esc(it.plan)}</span><span class="t-price">${usd(it.price)}${perLabel(it.per)}</span></button>
<button type="button" class="info" popovertarget="src-${it.id}" aria-label="Source for ${esc(it.service)} ${esc(it.plan)}">i</button>
<div class="pop" id="src-${it.id}" popover><p class="pop-h">${esc(it.service)} ${esc(it.plan)}</p><p>List price ${usd(it.price)}${perLabel(it.per)}</p><p>Source: <a href="${esc(it.source)}" rel="noopener">${esc(host(it.source))}</a></p><p>Checked ${fmtDate(it.checked)}</p>${it.then ? `<p>In ${it.then.year}: <a href="${esc(it.then.url)}" rel="noopener">${usd(it.then.price)}${perLabel(it.then.per)}</a></p>` : ''}<button type="button" class="pop-x" popovertarget="src-${it.id}" popovertargetaction="hide">Close</button></div>
</div>`;
  const chips = [...CATS.map(([k, label]) => [k, label]), ['all', 'All'], ['picked', 'Picked']]
    .map(([k, label]) => `<button type="button" class="chip" data-cat="${k}" aria-pressed="${k === 'tv'}">${esc(label)}<span class="n" aria-hidden="true"></span></button>`).join('');
  const page = `${SITE}${SCAN_DIR}/`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<link rel="canonical" href="${SITE}">
<title>Total Monthly Pricing: what your subscriptions cost for life</title>
<meta name="description" content="Tap the subscriptions you pay. See your monthly total and what you will pay by age ${END}. Every price links its source.">
<meta property="og:url" content="${SITE}">
<meta property="og:title" content="Your subscriptions, printed for life">
<meta property="og:description" content="Tap what you pay. Get the receipt. Every price links its source.">
<meta property="og:image" content="${SITE}${OG_HOME}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(OG_ALT)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}${OG_HOME}">
<link rel="preload" href="../fonts/instrument.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../fonts/departure.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="scan.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect x='3' y='1' width='10' height='14' fill='%23fffdf6'/%3E%3Cpath d='M5 5h6M5 8h6M5 11h4' stroke='%23222' /%3E%3C/svg%3E">
<script>document.documentElement.className='js'</script>
</head>
<body>
<header class="bar"><a class="mark" href="${SITE}">Total Monthly Pricing</a><a class="how-link" href="#how">How we count</a></header>
<main>
<section class="pick" aria-labelledby="h1">
 <h1 id="h1">What do your subscriptions cost for life?</h1>
 <div class="row">
  <label class="age"><span>Your age</span><input id="age" type="number" inputmode="numeric" min="13" max="79" value="${AGE}"></label>
  <button type="button" id="clear" class="ghost">Clear all</button>
 </div>
 <div class="chips" id="chips" role="group" aria-label="Show services">${chips}</div>
 <p class="sr" id="swap-note" role="status"></p>
 <div class="tiles" id="tiles">
${data.items.map(tile).join('\n')}
 </div>
 <p class="none" id="none-picked" hidden>Nothing picked yet. Tap a service.</p>
 <noscript><p class="none">The totals need JavaScript. Every price and source is in the list below.</p></noscript>
</section>
<section class="more" id="how" aria-label="How we count and sources">
 <details>
  <summary>How we count</summary>
  <p>Monthly plans count 12 times a year, yearly plans once. The total to age ${END} multiplies one year by the years you have left, at today's price.</p>
  <p>Today's list prices, held flat. Real prices tend to rise. Taxes not included.</p>
  <p>US list prices for new subscribers, checked ${asOf}. Intro and student prices left out.</p>
  <p>This page has no accounts, cookies or ads. Your picks stay in your browser.</p>
 </details>
 <details>
  <summary>All ${data.items.length} prices and sources</summary>
  <div class="tablewrap" tabindex="0" role="region" aria-label="Prices and sources">
  <table>
   <thead><tr><th scope="col">Service</th><th scope="col">Plan</th><th scope="col" class="num">Price</th><th scope="col">Source</th><th scope="col">Checked</th><th scope="col">Notes</th></tr></thead>
   <tbody>${tableHTML}</tbody>
  </table>
  </div>
 </details>
 <p class="links"><a href="../streaming-price-history/">Since launch</a><a href="../data/">Price data (CSV)</a></p>
</section>
</main>
<div class="total" id="total" role="region" aria-label="Your total">
 <div class="tot-life"><span class="tot-k">To age <span id="t-end">${END}</span> <span id="t-example" class="tag">Example</span><span id="t-count" class="tag tag-n" hidden></span></span><b id="t-life">${usdC(exLife)}</b></div>
 <div class="tot-month"><b id="t-month">${usdC(exMonth)}</b> a month<span id="t-annual" class="tot-sub" hidden></span><span class="tot-sub tot-day"><span id="t-day">${usdC(Math.round(exYear / 365.25))}</span> a day</span></div>
 <button type="button" id="sharebtn" class="share" aria-haspopup="dialog">Share</button>
</div>
<dialog id="share-dlg" aria-labelledby="share-h">
 <p id="share-h" class="dlg-h">Your receipt</p>
 <img id="share-img" alt="Your receipt" width="540" height="675">
 <div class="dlg-acts">
  <a id="x-post" class="btn" href="https://x.com/intent/post" target="_blank" rel="noopener noreferrer">Post to X</a>
  <button type="button" id="save" class="btn">Download image</button>
  <button type="button" id="share" class="btn">Copy link</button>
 </div>
 <span id="share-msg" role="status"></span>
 <form method="dialog"><button class="dlg-x">Close</button></form>
</dialog>
<script type="application/json" id="data">${JSON.stringify({ asOf, end: END, example: EXAMPLE, items: data.items.map(({ id, service, plan, price, per, source, checked, then }) => ({ id, service, plan, price, per, source, checked, then })) }).replace(/</g, '\\u003c')}</script>
<script src="scan.js" defer></script>
</body>
</html>`;
}
