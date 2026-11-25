#!/usr/bin/env node
// Re-check every price in data/prices.json against its source page and log the result.
// Usage: node scripts/recheck-prices.mjs [--log ../LOG.md] [--no-browser]
// Never edits prices.json. Each run replaces today's block in LOG.md, so reruns on the same day do not pile up.
// Pages are read with plain fetch. Pages that show no prices that way (built by JavaScript) are retried in
// headless Chrome through Playwright when it is installed; pass --no-browser to skip that.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const logPath = resolve(args.includes('--log') ? args[args.indexOf('--log') + 1] : join(here, '../../LOG.md'));
const useBrowser = !args.includes('--no-browser');
const { items } = JSON.parse(readFileSync(join(here, '../data/prices.json'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const PRICE = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?![\d.]\d)/g;
const NEAR = 300;
// Amounts that are offers or perks, not the plan's list price.
const PROMO = /(first (month|\d+ days?)[^$]*|up to|worth|save|earn|off|credit|gift card|trial[^$]*)\s*$/i;

const ctNow = () => new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit' });
const ctDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());

const htmlToText = (h) => h
  .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|td|th|span|section)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#36;|&dollar;/g, '$').replace(/&#x27;|&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t\r\f\v]+/g, ' ').replace(/\n\s*/g, '\n').trim();

const hasPrice = (t) => /\$\s?\d/.test(t);

async function fetchText(url) {
  const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow', signal: ac.signal });
    if (!r.ok) return { err: `HTTP ${r.status}` };
    return { text: htmlToText(await r.text()) };
  } catch (e) { return { err: e.name === 'AbortError' ? 'timeout' : e.message }; } finally { clearTimeout(timer); }
}

async function browserTexts(urls) {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch { return {}; }
  const b = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ userAgent: UA, locale: 'en-US', timezoneId: 'America/Chicago' });
  const out = {};
  await Promise.all(urls.map(async (u) => {
    const p = await ctx.newPage();
    try { await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 }); await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(2500); out[u] = { text: await p.evaluate(() => document.body.innerText), via: 'browser' }; }
    catch (e) { out[u] = { err: `browser: ${e.message.split('\n')[0].slice(0, 60)}` }; }
    await p.close();
  }));
  await b.close();
  return out;
}

const quote = (t, i, len) => t.slice(Math.max(0, i - 70), i + len + 50).replace(/\s+/g, ' ').trim();
const norm = (s) => Number(s.replace(/,/g, ''));
const planWords = (it) => it.plan.replace(/\(.*?\)/g, '').trim().toLowerCase();

function check(it, page) {
  if (!page || page.err) return { status: 'UNREADABLE', why: `fetch failed (${page ? page.err : 'no page'})` };
  const t = page.text, lower = t.toLowerCase();
  const prices = [...t.matchAll(PRICE)].map((m) => ({ v: norm(m[1]), i: m.index, raw: m[0] }));
  if (!prices.length) return { status: 'UNREADABLE', why: 'no prices found on the page' };
  const anchors = [];
  for (const key of [planWords(it), it.service.toLowerCase()]) { let i = -1; while ((i = lower.indexOf(key, i + 1)) !== -1) anchors.push(i); if (anchors.length) break; }
  const dist = (p) => anchors.length ? Math.min(...anchors.map((a) => Math.abs(p.i - a))) : Infinity;
  const want = it.per === 'year' ? [it.price, Math.round((it.price / 12) * 100) / 100] : [it.price];
  const same = prices.filter((p) => want.some((w) => Math.abs(p.v - w) < 0.005)).sort((a, b) => dist(a) - dist(b));
  if (same.length) {
    const p = same[0];
    return { status: 'OK', quote: quote(t, p.i, p.raw.length), note: dist(p) <= NEAR ? '' : ' (price is on the page but not next to the plan name)' };
  }
  const after = prices.filter((p) => !PROMO.test(t.slice(Math.max(0, p.i - 30), p.i))).filter((p) => anchors.some((a) => p.i >= a && p.i - a <= NEAR)).sort((a, b) => dist(a) - dist(b));
  if (after.length) return { status: 'CHANGED', now: after[0].v, quote: quote(t, after[0].i, after[0].raw.length) };
  return { status: 'UNREADABLE', why: `stored price $${it.price} not found, and no price next to "${it.plan}"` };
}

const t0 = Date.now();
const urls = [...new Set(items.map((i) => i.source))];
const pages = Object.fromEntries(await Promise.all(urls.map(async (u) => [u, await fetchText(u)])));
// Retry in a real browser any page where a row did not come back OK (JS-built pages often hide prices from fetch).
const retry = urls.filter((u) => items.some((it) => it.source === u && check(it, pages[u]).status !== 'OK'));
if (useBrowser && retry.length) {
  const got = await browserTexts(retry);
  const okCount = (u, pg) => items.filter((it) => it.source === u && check(it, pg).status === 'OK').length;
  for (const [u, r] of Object.entries(got)) if (r.text && okCount(u, r) >= okCount(u, pages[u])) pages[u] = r;
}

const rows = items.map((it) => ({ it, ...check(it, pages[it.source]) }));
const count = (s) => rows.filter((r) => r.status === s).length;
const money = (v) => `$${Number(v).toFixed(Number.isInteger(v) ? 0 : 2)}`;
const date = ctDate();
const lines = [
  `<!-- recheck ${date} -->`,
  `## Price re-check ${ctNow()} CT (scripts/recheck-prices.mjs)`,
  `${count('OK')} OK, ${count('CHANGED')} CHANGED, ${count('UNREADABLE')} UNREADABLE of ${rows.length} rows, ${urls.length} pages, ${((Date.now() - t0) / 1000).toFixed(0)} s. prices.json was not edited; CHANGED rows need a person to confirm.`,
  '',
  ...rows.map(({ it, status, quote: q, now, why, note }) => {
    const name = `${it.id} (${it.service} ${it.plan}, stored ${money(it.price)}/${it.per})`;
    if (status === 'OK') return `- OK ${name}${note || ''}: "${q}"`;
    if (status === 'CHANGED') return `- CHANGED ${name}: ${money(it.price)} -> ${money(now)}, quote "${q}" (${it.source})`;
    return `- UNREADABLE ${name}: ${why} (${it.source})`;
  }),
  `<!-- /recheck ${date} -->`,
].join('\n');

let log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
const block = new RegExp(`<!-- recheck ${date} -->[\\s\\S]*?<!-- /recheck ${date} -->`);
log = block.test(log) ? log.replace(block, lines) : `${log.replace(/\s*$/, '')}\n\n${lines}\n`;
writeFileSync(logPath, log);
console.log(`${count('OK')} OK, ${count('CHANGED')} CHANGED, ${count('UNREADABLE')} UNREADABLE (${rows.length} rows) -> ${logPath}`);
for (const r of rows) if (r.status !== 'OK') console.log(r.status, r.it.id, r.now ?? r.why ?? '');
