// Writes src/scan-logos.json: one logo per service for the /scan-preview/ tiles.
// Run: node scripts/make-scan-logos.mjs <path to an installed simple-icons package's index.mjs>
// 1) Simple Icons (CC0) paths + brand hex. 2) The company's own press-kit file in src/logos/ (URL recorded).
// 3) Otherwise a plain letter badge in the brand's colour. Never a redrawn logo.
import { writeFileSync, readFileSync } from 'fs';
const si = await import(process.argv[2]);
import { dirname, join } from 'path';
const ver = JSON.parse(readFileSync(join(dirname(process.argv[2]), 'package.json'), 'utf8')).version;
const SI = { 'Netflix': 'netflix', 'HBO Max': 'hbomax', 'Apple TV': 'appletv', 'YouTube TV': 'youtubetv', 'Spotify': 'spotify', 'Apple Music': 'applemusic', 'YouTube Premium': 'youtube', 'Audible': 'audible', 'iCloud+': 'icloud', 'Apple One': 'apple', 'Google One': 'google', 'Google AI Pro': 'googlegemini', '1Password': '1password', 'Claude': 'claude', 'GitHub Copilot': 'githubcopilot', 'PlayStation Plus': 'playstation', 'Apple Arcade': 'applearcade', 'Uber One': 'uber', 'Instacart+': 'instacart', 'Peloton': 'peloton', 'Strava': 'strava', 'Headspace': 'headspace' };
const KIT = {
  'Philo': { file: 'philo.svg', w: 256, h: 107, src: 'https://www.philo.com/press/assets (Philo Logo, transparent, SVG format)' },
  'ChatGPT': { file: 'chatgpt.svg', w: 721, h: 721, src: 'https://openai.com/brand/ (https://cdn.openai.com/brand/OpenAI-Logos-2025.zip, OpenAI-black-monoblossom.svg)' },
  'SiriusXM': { file: 'siriusxm.png', w: 96, h: 96, src: 'https://corporate.siriusxm.com/media-assets (SiriusXM Icon - Blue, PNG, trimmed and scaled to 96px)' },
};
const MONO = { 'Disney+': ['D', '#0063e5', '#fff'], 'Hulu': ['H', '#1ce783', '#1d1a16'], 'Disney+, Hulu Bundle': ['D', '#0063e5', '#fff'], 'Peacock': ['P', '#1d1a16', '#fff'], 'AMC+': ['A', '#1d1a16', '#fff'], 'ESPN': ['E', '#d50a0a', '#fff'], 'Microsoft 365': ['M', '#0078d4', '#fff'], 'Adobe Photoshop': ['A', '#31a8ff', '#001e36'], 'Xbox Game Pass': ['X', '#107c10', '#fff'], 'Nintendo Switch Online': ['N', '#e60012', '#fff'], 'Amazon Prime': ['A', '#00a8e1', '#1d1a16'], 'Prime Video': ['P', '#00a8e1', '#1d1a16'] };
const all = Object.values(si).filter((x) => x && x.slug);
const out = {};
for (const [svc, slug] of Object.entries(SI)) { const i = all.find((x) => x.slug === slug); if (!i) throw new Error(`no simple-icon ${slug}`); out[svc] = { kind: 'si', slug, hex: '#' + i.hex, path: i.path, title: i.title }; }
for (const [svc, k] of Object.entries(KIT)) out[svc] = { kind: 'kit', ...k };
for (const [svc, [l, bg, fg]] of Object.entries(MONO)) out[svc] = { kind: 'mono', l, bg, fg };
writeFileSync(new URL('../src/scan-logos.json', import.meta.url), JSON.stringify({ simpleIcons: ver || '', logos: out }, null, 1));
console.log(Object.keys(out).length, 'services');
