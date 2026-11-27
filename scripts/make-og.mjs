// Draws the home link-card image (1200x630) from a build of this site.
// Usage: node scripts/make-og.mjs <base url of docs/, e.g. http://localhost:18743/> [out=src/og-receipt.png] [--ansel]
// --ansel: Ansel's brand-kit layout (lockup, headline, curling receipt from scripts/og-assets/) with the same real numbers.
// The receipt is the page's own drawReceipt() for the default (example) basket. The big numbers are
// read from the page, and checked against data/prices.json here. Nothing is typed in by hand.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMPLE_IDS, SCAN_EXAMPLE_IDS } from './example.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PW || join(here, '../../qa/node_modules/playwright/index.mjs'));
const argv = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ANSEL = process.argv.includes('--ansel');
const base = argv[0] || 'http://localhost:18743/';
const outPath = argv[1] || join(here, '../src/og-receipt.png');

const data = JSON.parse(readFileSync(join(here, '../data/prices.json'), 'utf8'));
const byId = new Map(data.items.map((i) => [i.id, i]));
const cents = (n) => Math.round(Number(n) * 100);
const usd = (c) => `$${Math.floor(c / 100).toLocaleString('en-US')}.${String(c % 100).padStart(2, '0')}`;
const AGE = 30, END = 80;
// --ansel stages og-receipt-v2 for the scan preview, so it uses (and checks) the preview's default basket and page.
const ex = (ANSEL ? SCAN_EXAMPLE_IDS : EXAMPLE_IDS).map((id) => byId.get(id));
const year = ex.reduce((s, it) => s + (it.per === 'month' ? cents(it.price) * 12 : cents(it.price)), 0);
const month = ex.reduce((s, it) => s + (it.per === 'month' ? cents(it.price) : 0), 0);
const want = { life: usd(year * (END - AGE)), day: usd(Math.round(year / 365.25)), month: usd(month) };

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(ANSEL ? base + 'scan-preview/' : base, { waitUntil: 'networkidle' });
const got = await p.evaluate(async (scan) => {
  const cv = await window.__receipt();
  return { png: cv.toDataURL('image/png'), life: document.querySelector('#t-life').textContent, day: document.querySelector('#t-day').textContent,
    month: document.querySelector('#t-month').textContent, cvLife: Number(cv.dataset.life), w: cv.width, h: cv.height,
    asOf: scan ? JSON.parse(document.getElementById('data').textContent).asOf : document.querySelector('#r-asof').textContent,
    example: !document.querySelector(scan ? '#t-example' : '#r-example').hidden, picked: scan ? [...document.querySelectorAll('.tile[aria-pressed=true]')].map((t) => t.dataset.id).sort() : null };
}, ANSEL);
if (ANSEL && got.picked.join() !== [...SCAN_EXAMPLE_IDS].sort().join()) throw new Error(`scan preview default picks ${got.picked} != ${SCAN_EXAMPLE_IDS}`);
for (const k of ['life', 'day', 'month']) if (got[k] !== want[k]) throw new Error(`${k}: page ${got[k]} != prices.json ${want[k]}`);
if (usd(got.cvLife) !== want.life) throw new Error(`receipt card ${usd(got.cvLife)} != ${want.life}`);
if (!got.example) throw new Error('page is not on the example basket');
const names = ex.map((it) => `${it.service} ${it.plan}`);
const lifeShort = want.life.replace(/\.00$/, '');

if (ANSEL) { await anselCard(); process.exit(0); }
const card = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await card.goto(base + 'robots.txt'); // same origin as the fonts, so they load without CORS
await card.setContent(`<!doctype html><html><head><base href="${base}"><link rel="stylesheet" href="style.css">
<style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:var(--orange);color:var(--ink)}
.wrap{position:relative;width:1200px;height:630px}
.l{position:absolute;left:64px;top:52px;width:620px}
.k{font:400 24px/1 var(--mono);letter-spacing:.06em;margin:0 0 14px}
.n{font:700 172px/.86 var(--sans);font-stretch:75%;letter-spacing:-.03em;margin:0}
.d{font:700 50px/1.05 var(--sans);font-stretch:80%;margin:18px 0 0}
.b{font:400 23px/1.35 var(--sans);margin:22px 0 0;max-width:560px}
.t{font:600 23px/1.35 var(--sans);margin:10px 0 0}
.u{position:absolute;left:64px;bottom:46px;font:700 34px/1 var(--sans);font-stretch:80%;letter-spacing:-.01em}
.nb{white-space:nowrap}
.r{position:absolute;right:58px;top:22px;width:452px;transform:rotate(2.2deg);box-shadow:0 24px 40px -18px rgba(60,20,0,.55)}
.r{overflow:hidden}
.r img{display:block;width:452px;height:auto;margin-top:-12px}
</style></head><body><div class="wrap">
<div class="l"><p class="k">TO AGE ${END}, AT TODAY'S PRICES</p><p class="n">${lifeShort}</p>
<p class="d">${want.day} a day, every day</p>
<p class="b">${names.join(', ').replace(/, ([^,]*)$/, ' and $1')} from age ${AGE}. List prices as of <span class="nb">${got.asOf}</span>.</p>
<p class="t">Tick yours. Every price links its source.</p></div>
<div class="u">totalmonthlypricing.com</div>
<div class="r"><img src="${got.png}" alt=""></div>
</div></body></html>`, { waitUntil: 'networkidle' });
await card.evaluate(async () => { await Promise.all(['700 172px Instrument', '600 23px Instrument', '400 23px Instrument', '24px Departure'].map((f) => document.fonts.load(f))); await document.fonts.ready; });
const fontsOk = await card.evaluate(() => document.fonts.check('700 172px Instrument') && document.fonts.check('24px Departure'));
if (!fontsOk) throw new Error('site fonts did not load');
const over = await card.evaluate(() => [...document.querySelectorAll('.l p,.u')].filter((e) => e.getBoundingClientRect().right > 690).map((e) => e.className));
if (over.length) throw new Error('left text runs under the receipt: ' + over.join(','));
writeFileSync(outPath, await card.screenshot({ type: 'png' }));
await b.close();
console.log(JSON.stringify({ out: outPath, ...want, names, asOf: got.asOf }));

// Ansel's og-card layout. The numbers on the paper and in the headline come from `want` (prices.json), and the
// rendered text is read back and checked before the PNG is written.
async function anselCard() {
  const months = (END - AGE) * 12;
  const allMonthly = ex.every((it) => it.per === 'month');
  const rate = allMonthly ? `${want.month}/mo x ${months} mo` : `${usd(year)}/yr x ${END - AGE} yrs`;
  const lifeBig = want.life.replace(/\.00$/, '');
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  // Ansel's phone hero, with the EXAMPLE text on the flat front swapped for real numbers in the same plane.
  let hero = readFileSync(join(here, 'og-assets/hero-receipt-780x300.svg'), 'utf8');
  const g0 = hero.indexOf('<g transform="matrix('); if (g0 < 0 || hero.indexOf('<g transform="matrix(', g0 + 1) > 0) throw new Error('hero: expected one text group');
  const open = hero.indexOf('>', g0) + 1, close = hero.indexOf('</g>', open);
  const W = 250, T = (t, y, size, col, cls) => `<text class="${cls}" x="${W / 2}" y="${y}" font-size="${size}" fill="${col}" text-anchor="middle" font-family="Departure, monospace">${esc(t)}</text>`;
  const front = T(`TO AGE ${END}`, 40, 19, '#1D1A16', 'f-k') + `<path d="M16 56H${W - 16}" stroke="#1D1A16" stroke-width="2" stroke-dasharray="6 5"/>` + T(rate, 86, 18, '#4A4239', 'f-rate') + T(lifeBig, 136, 40, '#B2300B', 'f-life');
  hero = hero.slice(0, open) + front + hero.slice(close).replace(/<title>[^<]*<\/title>/, '');
  hero = hero.replace(/^<svg /, '<svg class="hero" ');
  const names = ex.map((it) => `${it.service} ${it.plan}`).join(' + ');
  const card = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await card.goto(base + 'robots.txt');
  await card.setContent(`<!doctype html><html><head><base href="${base}"><link rel="stylesheet" href="style.css">
<style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#FF6A2B;color:#1D1A16}
.wrap{position:relative;width:1200px;height:630px}
.lock{position:absolute;left:60px;top:44px;height:66px;width:auto}
.names{position:absolute;left:62px;top:136px;margin:0;font:400 22px/1 var(--mono)}
.h{position:absolute;left:58px;top:166px;margin:0;font:700 84px/.98 var(--sans);font-stretch:75%;letter-spacing:-.025em}
.u{position:absolute;left:60px;top:562px;margin:0;font:400 24px/1 var(--mono)}
.asof{position:absolute;left:60px;top:522px;margin:0;font:400 18px/1 var(--mono);color:#4A4239}
.hero{position:absolute;left:380px;top:318px;width:800px;height:308px}
</style></head><body><div class="wrap">
<img class="lock" src="scan-preview/logo.svg" alt="">
<p class="names">${esc(names)}</p>
<p class="h"><span class="h-life">${esc(lifeBig)} by age ${END}.</span><br><span class="h-day">${esc(want.day)} a day, every day.</span></p>
<p class="asof">List prices, ${esc(got.asOf)}</p>
<p class="u">totalmonthlypricing.com</p>
${hero}
</div></body></html>`, { waitUntil: 'networkidle' });
  await card.evaluate(async () => { await Promise.all(['700 84px Instrument', '22px Departure', '40px Departure'].map((f) => document.fonts.load(f))); await document.fonts.ready; });
  if (!(await card.evaluate(() => document.fonts.check('700 84px Instrument') && document.fonts.check('40px Departure')))) throw new Error('site fonts did not load');
  const chk = await card.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const lim = (e) => e.getComputedTextLength();
    const box = (s) => q(s).getBoundingClientRect();
    return { life: q('.f-life').textContent, rate: q('.f-rate').textContent, hl: q('.h-life').textContent, hd: q('.h-day').textContent,
      fit: ['.f-k', '.f-rate', '.f-life'].map((s) => lim(q(s))), lock: q('.lock').naturalWidth > 0,
      clash: box('.h').bottom > box('.hero').top + 40 && box('.h').right > box('.hero').left + 120, names: box('.names').right, asof: box('.asof').right };
  });
  if (chk.life !== lifeBig || !chk.hl.startsWith(lifeBig) || chk.hd !== `${want.day} a day, every day.` || chk.rate !== rate) throw new Error('ansel card text mismatch: ' + JSON.stringify(chk));
  if (chk.fit.some((x) => x > 218)) throw new Error('text runs off the paper: ' + chk.fit.join(','));
  if (!chk.lock) throw new Error('lockup did not load');
  if (chk.names > 1140 || chk.asof > 370) throw new Error('text overflow: ' + JSON.stringify(chk));
  writeFileSync(outPath, await card.screenshot({ type: 'png' }));
  await b.close();
  console.log(JSON.stringify({ out: outPath, style: 'ansel', ...want, rate, lifeBig, names, asOf: got.asOf }));
}
