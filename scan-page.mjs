// Scan layout preview (/scan-preview/): big tiles, one running total, sources one tap away.
// Same data file and the same math as the home page. Not linked, noindex, not in the sitemap.
import { readFileSync } from 'node:fs';
export const SCAN_DIR = 'scan-preview';
// One logo per service (scripts/make-scan-logos.mjs): Simple Icons, a press-kit file, or a letter badge.
const { logos: LOGOS } = JSON.parse(readFileSync(new URL('./src/scan-logos.json', import.meta.url), 'utf8'));
// Popular chip: published subscriber counts (data/popularity.json), kept apart from the price sources.
const POP = JSON.parse(readFileSync(new URL('./data/popularity.json', import.meta.url), 'utf8'));
// Small chip pictograms, drawn here (not logos).
const ICON = {
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  games: '<rect x="2" y="7" width="20" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r=".8" fill="currentColor"/><circle cx="17.5" cy="14" r=".8" fill="currentColor"/>',
  more: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  picked: '<path d="M4 12.5l5 5L20 6.5"/>',
  popular: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
};
const icon = (k) => ICON[k] ? `<svg class="ci" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>` : '';
// A few big filters, made from the groups already in prices.json.
const CATS = [
  ['tv', 'TV', ['TV', 'Live TV']],
  ['music', 'Music', ['Music & audio']],
  ['apps', 'Apps & AI', ['Storage & apps', 'AI']],
  ['games', 'Games', ['Games']],
  ['more', 'Shop & fitness', ['Shopping & delivery', 'Fitness & mind']],
];
export function scanPage({ data, SITE, AGE, END, EXAMPLE, monthC, yearC, asOf, esc, usd, usdC, perLabel, host, fmtDate, tableHTML, OG_HOME, OG_ALT }) {
  // The preview's own default basket (SCAN_EXAMPLE_IDS), so the bar on first paint matches the ticked tiles.
  const exItems = EXAMPLE.map((id) => data.items.find((i) => i.id === id));
  const exMonth = exItems.reduce((t, it) => t + monthC(it), 0), exYear = exItems.reduce((t, it) => t + yearC(it), 0), exLife = exYear * (END - AGE);
  // Ranked by the published count, biggest first; services with no service-specific count go last.
  const byIdAll = new Map(data.items.map((it) => [it.id, it]));
  for (const p of POP.items) {
    const it = byIdAll.get(p.id); if (!it) throw new Error(`popularity: unknown id ${p.id}`);
    for (const k of ['countText', 'measure', 'scope', 'period', 'source', 'publisher', 'published']) if (!p[k]) throw new Error(`popularity ${p.id}: missing ${k}`);
    if (!/^https:\/\//.test(p.source) || !/^\d{4}-\d{2}-\d{2}$/.test(p.published)) throw new Error(`popularity ${p.id}: bad source or date`);
    if (p.count !== null && !(Number.isInteger(p.count) && p.count > 0)) throw new Error(`popularity ${p.id}: count must be a published integer or null`);
  }
  if (new Set(POP.items.map((p) => byIdAll.get(p.id).service)).size !== POP.items.length) throw new Error('popularity: one tile per service');
  // Ranked: biggest published count first. Unranked services (no count of their own) sit at a fixed slot from
  // popularity.json "slots" and say "not ranked"; they never get a number. The order never changes on the page.
  const ranked = POP.items.filter((p) => p.count !== null).sort((a, b) => b.count - a.count);
  const unranked = POP.items.filter((p) => p.count === null);
  for (const p of unranked) if (!(POP.slots && Number.isInteger(POP.slots[p.id]))) throw new Error(`popularity ${p.id}: no count, so it needs a fixed slot`);
  const popOf = new Map(ranked.map((p, i) => [p.id, { ...p, rank: i + 1 }]));
  for (const p of unranked) popOf.set(p.id, { ...p, rank: 0 });
  const popIds = ranked.map((p) => p.id);
  for (const p of [...unranked].sort((a, b) => POP.slots[a.id] - POP.slots[b.id])) popIds.splice(POP.slots[p.id] - 1, 0, p.id);
  for (const id of EXAMPLE) if (!popIds.includes(id) || popIds.indexOf(id) >= 6) throw new Error(`example ${id} must be one of Popular's first 6 tiles`);
  const firstOrder = [...popIds, ...data.items.map((it) => it.id).filter((id) => !popOf.has(id))];
  const catOf = (it) => { const c = CATS.find(([, , gs]) => gs.includes(it.group)); if (!c) throw new Error(`${it.id}: group ${it.group} has no scan filter`); return c[0]; };
  const logo = (it) => {
    const l = LOGOS[it.service]; if (!l) throw new Error(`${it.service}: no logo entry`);
    const WIDE = ['youtubetv', 'appletv']; // Simple Icons wordmarks get a wider badge so they stay readable
    if (l.kind === 'si') return `<span class="lg${WIDE.includes(l.slug) ? ' wide' : ''}" data-logo="si" aria-hidden="true"><svg viewBox="0 0 24 24" style="color:${l.hex}"><use href="#si-${l.slug}"/></svg></span>`;
    if (l.kind === 'kit') {
      const lazy = popOf.has(it.id) ? '' : ' loading="lazy"';
      const imgs = (l.files || [[l.file, l.w, l.h]]).map(([f, w, h]) => `<img src="logos/${f}" width="${w}" height="${h}" alt="" decoding="async"${lazy}>`).join('');
      return `<span class="lg${l.wide ? ' wide' : ''}${l.dark ? ' dark' : ''}${l.files ? ' pair' : ''}" data-logo="kit" aria-hidden="true">${imgs}</span>`;
    }
    return `<span class="lg mono" data-logo="mono" data-l="${esc(l.l)}" style="--bg:${l.bg};--fg:${l.fg}" aria-hidden="true"></span>`;
  };
  const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${[...new Map(Object.values(LOGOS).filter((l) => l.kind === 'si').map((l) => [l.slug, l])).values()].map((l) => `<symbol id="si-${l.slug}" viewBox="0 0 24 24"><path fill="currentColor" d="${l.path}"/></symbol>`).join('')}</defs></svg>`;
  const popP = (it) => { const p = popOf.get(it.id); if (!p) return '';
    return `<div class="pop-n" data-pop="${p.rank || 'none'}"><p class="pop-k">${p.rank ? `Popular #${p.rank}: ${esc(it.service)} as a whole` : 'Popular, not ranked'}</p><p><b>${esc(p.countText)}</b> ${esc(p.measure)} (${esc(p.period)})</p><p class="pop-scope">${esc(p.scope)}</p><p>Count source: <a href="${esc(p.source)}" rel="noopener">${esc(p.publisher)}</a></p><p>Published ${fmtDate(p.published)}</p>${p.note ? `<p>${esc(p.note)}</p>` : ''}</div>`; };
  const tile = (it) => `<div class="tw" data-id="${it.id}" data-cat="${catOf(it)}"${popOf.has(it.id) ? ` data-pop="${popOf.get(it.id).rank || 'none'}"` : ' hidden'}>
<button type="button" class="tile" data-id="${it.id}" aria-pressed="${EXAMPLE.includes(it.id)}">${logo(it)}<span class="t-name">${esc(it.service)}</span><span class="t-plan">${esc(it.plan)}</span><span class="t-price">${usd(it.price)}${perLabel(it.per)}</span></button>
<button type="button" class="info" popovertarget="src-${it.id}" aria-label="Source for ${esc(it.service)} ${esc(it.plan)}">i</button>
<div class="pop" id="src-${it.id}" popover><p class="pop-h">${esc(it.service)} ${esc(it.plan)}</p><p>List price ${usd(it.price)}${perLabel(it.per)}</p><p>Source: <a href="${esc(it.source)}" rel="noopener">${esc(host(it.source))}</a></p><p>Checked ${fmtDate(it.checked)}</p>${it.then ? `<p>In ${it.then.year}: <a href="${esc(it.then.url)}" rel="noopener">${usd(it.then.price)}${perLabel(it.then.per)}</a></p>` : ''}${popP(it)}<button type="button" class="pop-x" popovertarget="src-${it.id}" popovertargetaction="hide">Close</button></div>
</div>`;
  const chips = [['popular', 'Popular'], ...CATS.map(([k, label]) => [k, label]), ['all', 'All'], ['picked', 'Picked']]
    .map(([k, label]) => `<button type="button" class="chip" data-cat="${k}" aria-pressed="${k === 'popular'}">${icon(k)}${esc(label)}<span class="n" aria-hidden="true"></span></button>`).join('');
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
<meta name="twitter:image:alt" content="${esc(OG_ALT)}">
<link rel="preload" href="../fonts/instrument.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../fonts/departure.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="scan.css">
<link rel="icon" href="favicon.ico" sizes="32x32">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="favicon-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="favicon-16.png" type="image/png" sizes="16x16">
<link rel="apple-touch-icon" href="apple-touch-icon-180.png">
<meta name="theme-color" content="#FF6A2B">
<script>document.documentElement.className='js'</script>
</head>
<body>
${sprite}
<header class="bar"><a class="mark" href="${SITE}"><img src="logo.svg" width="710" height="152" alt="Total Monthly Pricing"></a><nav class="hnav" aria-label="Page"><a class="how-link" href="#how">How we count</a><a class="how-link" href="#all-prices" id="src-link">Sources</a></nav></header>
<main>
<section class="pick" aria-labelledby="h1">
 <div class="top">
 <picture class="art">
  <source media="(min-width: 1100px)" type="image/avif" srcset="hero-receipt-1200x500-nonum.avif 1x, hero-receipt-2400x1000-nonum.avif 2x" width="1200" height="500">
  <source media="(min-width: 1100px)" type="image/webp" srcset="hero-receipt-1200x500-nonum.webp 1x, hero-receipt-2400x1000-nonum.webp 2x" width="1200" height="500">
  <source type="image/avif" srcset="hero-receipt-780x300-nonum.avif 1x, hero-receipt-1560x600-nonum.avif 2x" width="780" height="300">
  <img src="hero-receipt-780x300-nonum.webp" srcset="hero-receipt-1560x600-nonum.webp 2x" width="780" height="300" alt="A long blank example receipt curling out of a printer, with a red bar where the total goes." fetchpriority="high" decoding="async">
 </picture>
 <h1 id="h1">What do your subscriptions cost for life?</h1>
 <label class="age"><span>Your age</span><input id="age" type="number" inputmode="numeric" min="13" max="79" value="${AGE}"></label>
 </div>
 <div class="filters">
  <div class="chips" id="chips" role="group" aria-label="Show services">${chips}</div>
 </div>
 <p class="sr" id="swap-note" role="status"></p>
 <div class="tiles" id="tiles">
${firstOrder.map((id) => tile(byIdAll.get(id))).join('\n')}
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
  <p>Popular = largest published subscriber counts; companies count differently. Each count is for the whole service, not the plan on the tile. iCloud+ has no published count, so it sits third, not ranked. Sources are under each i.</p>
  <p>Logos belong to their owners.</p>
 </details>
 <details id="all-prices">
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
 <div class="tot-month"><b id="t-month">${usdC(exMonth)}</b><span> a month</span><span id="t-annual" class="tot-sub" hidden></span><span class="tot-sub tot-day"><span id="t-day">${usdC(Math.round(exYear / 365.25))}</span> a day</span><span id="t-hint" class="tot-sub" hidden>Tap a service to add it up</span></div>
 <div class="tot-acts"><button type="button" id="sharebtn" class="share" aria-haspopup="dialog">Share</button><button type="button" id="clear" class="ghost">Clear all</button></div>
</div>
<dialog id="share-dlg" aria-labelledby="share-h">
 <p id="share-h" class="dlg-h">Your receipt</p>
 <img id="share-img" alt="Your receipt" width="540" height="675">
 <div class="dlg-acts">
  <a id="x-post" class="btn" href="https://x.com/intent/post" target="_blank" rel="noopener noreferrer">Post to X</a>
  <button type="button" id="save" class="btn">Download image</button>
  <button type="button" id="share" class="btn">Copy link</button>
  <form method="dialog"><button class="dlg-x">Close</button></form>
 </div>
 <span id="share-msg" role="status"></span>
</dialog>
<script type="application/json" id="data">${JSON.stringify({ asOf, end: END, example: EXAMPLE, popular: popIds, items: data.items.map(({ id, service, plan, price, per, source, checked, then }) => ({ id, service, plan, price, per, source, checked, then })) }).replace(/</g, '\\u003c')}</script>
<script src="scan.js" defer></script>
</body>
</html>`;
}
