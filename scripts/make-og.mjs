// Draws the home link-card image (1200x630) from a build of this site.
// Usage: node scripts/make-og.mjs <base url of docs/, e.g. http://localhost:18743/> [out=src/og-receipt.png]
// The receipt is the page's own drawReceipt() for the default (example) basket. The big numbers are
// read from the page, and checked against data/prices.json here. Nothing is typed in by hand.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMPLE_IDS } from './example.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PW || join(here, '../../qa/node_modules/playwright/index.mjs'));
const base = process.argv[2] || 'http://localhost:18743/';
const outPath = process.argv[3] || join(here, '../src/og-receipt.png');

const data = JSON.parse(readFileSync(join(here, '../data/prices.json'), 'utf8'));
const byId = new Map(data.items.map((i) => [i.id, i]));
const cents = (n) => Math.round(Number(n) * 100);
const usd = (c) => `$${Math.floor(c / 100).toLocaleString('en-US')}.${String(c % 100).padStart(2, '0')}`;
const AGE = 30, END = 80;
const ex = EXAMPLE_IDS.map((id) => byId.get(id));
const year = ex.reduce((s, it) => s + (it.per === 'month' ? cents(it.price) * 12 : cents(it.price)), 0);
const month = ex.reduce((s, it) => s + (it.per === 'month' ? cents(it.price) : 0), 0);
const want = { life: usd(year * (END - AGE)), day: usd(Math.round(year / 365.25)), month: usd(month) };

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(base, { waitUntil: 'networkidle' });
const got = await p.evaluate(async () => {
  const cv = await window.__receipt();
  return { png: cv.toDataURL('image/png'), life: document.querySelector('#t-life').textContent, day: document.querySelector('#t-day').textContent,
    month: document.querySelector('#t-month').textContent, cvLife: Number(cv.dataset.life), w: cv.width, h: cv.height,
    asOf: document.querySelector('#r-asof').textContent, example: !document.querySelector('#r-example').hidden };
});
for (const k of ['life', 'day', 'month']) if (got[k] !== want[k]) throw new Error(`${k}: page ${got[k]} != prices.json ${want[k]}`);
if (usd(got.cvLife) !== want.life) throw new Error(`receipt card ${usd(got.cvLife)} != ${want.life}`);
if (!got.example) throw new Error('page is not on the example basket');
const names = ex.map((it) => `${it.service} ${it.plan}`);
const lifeShort = want.life.replace(/\.00$/, '');

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
