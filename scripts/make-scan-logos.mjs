// Writes src/scan-logos.json: one logo per service for the /scan-preview/ tiles.
// Run: node scripts/make-scan-logos.mjs <path to an installed simple-icons package's index.mjs>
// 1) Simple Icons (CC0) paths + brand hex. 2) The company's own press-kit file in src/logos/ (URL recorded).
// 3) Otherwise a plain letter badge in the brand's colour. Never a redrawn logo.
import { writeFileSync, readFileSync } from 'fs';
const si = await import(process.argv[2]);
import { dirname, join } from 'path';
const ver = JSON.parse(readFileSync(join(dirname(process.argv[2]), 'package.json'), 'utf8')).version;
const SI = { 'Netflix': 'netflix', 'Apple TV': 'appletv', 'YouTube TV': 'youtubetv', 'Spotify': 'spotify', 'Apple Music': 'applemusic', 'YouTube Premium': 'youtube', 'Audible': 'audible', 'iCloud+': 'icloud', 'Apple One': 'apple', 'Google One': 'google', 'Google AI Pro': 'googlegemini', '1Password': '1password', 'Claude': 'claude', 'GitHub Copilot': 'githubcopilot', 'PlayStation Plus': 'playstation', 'Apple Arcade': 'applearcade', 'Uber One': 'uber', 'Instacart+': 'instacart', 'Peloton': 'peloton', 'Strava': 'strava', 'Headspace': 'headspace' };
const KIT = {
  // Files served on the company's own site (or its press page) first; Wikimedia Commons copies of the official mark only when the site serves a raster.
  'Philo': { file: 'philo.svg', w: 256, h: 107, wide: true, src: 'https://www.philo.com/press/assets (Philo Logo, transparent, SVG format)' },
  'ChatGPT': { file: 'chatgpt.svg', w: 721, h: 721, src: 'https://openai.com/brand/ (https://cdn.openai.com/brand/OpenAI-Logos-2025.zip, OpenAI-black-monoblossom.svg)' },
  'SiriusXM': { file: 'siriusxm.png', w: 96, h: 96, src: 'https://corporate.siriusxm.com/media-assets (SiriusXM Icon - Blue, PNG, trimmed and scaled to 96px)' },
  'Hulu': { file: 'hulu.svg', w: 61, h: 24, wide: true, src: 'https://www.hulu.com/welcome header logo (inline SVG; fill set to the #1CE783 green hulu.com shows it in)' },
  'Peacock': { file: 'peacock.svg', w: 1607, h: 400, wide: true, dark: true, src: 'https://www.peacocktv.com/ header logo (inline SVG, data-testid="peacock-wob-logo", white on black)' },
  'Nintendo Switch Online': { file: 'nintendo.svg', w: 97, h: 24, wide: true, src: 'https://www.nintendo.com/us/online/ header logo (inline SVG NintendoRacetrackLogoIcon, currentColor set to Nintendo red #E60012)' },
  'AMC+': { file: 'amcplus.svg', w: 78, h: 40, wide: true, dark: true, src: 'https://www.amcplus.com/ (join.amcplus.com page asset https://d9hhrg4mnvzow.cloudfront.net/join.amcplus.com/a9b3fc1e-amcplus-logo-sm.svg)' },
  'Adobe Photoshop': { file: 'photoshop.svg', w: 64, h: 64, src: 'https://www.adobe.com/products/photoshop.html (https://www.adobe.com/federal/assets/svgs/photoshop.svg)' },
  'Disney+': { file: 'disneyplus.svg', w: 1041, h: 565, wide: true, src: 'https://commons.wikimedia.org/wiki/File:Disney%2B_logo.svg ({{PD-textlogo|simple}}, {{Trademarked}}); disneyplus.com serves only a raster' },
  'Disney+, Hulu Bundle': { files: [['disneyplus.svg', 1041, 565], ['hulu.svg', 61, 24]], wide: true, src: 'Disney+ and Hulu files above, side by side' },
  'ESPN': { file: 'espn.svg', w: 554, h: 137, wide: true, src: 'https://commons.wikimedia.org/wiki/File:ESPN_wordmark.svg ({{PD-textlogo}}, {{Trademarked}}); viewBox added; espn.com serves a raster' },
  'Microsoft 365': { file: 'microsoft365.svg', w: 40, h: 44, src: 'https://commons.wikimedia.org/wiki/File:Microsoft_365_(2022).svg ({{PD-textlogo}}); microsoft.com serves a raster' },
  'Xbox Game Pass': { file: 'xboxgamepass.svg', w: 151, h: 106, src: 'https://commons.wikimedia.org/wiki/File:Xbox_Game_Pass_new_logo_-_colored_version.svg ({{PD-textlogo}}, {{Trademarked}}); xbox.com serves a raster' },
  'Amazon Prime': { file: 'amazonprime.svg', w: 4606, h: 2724, wide: true, src: 'https://commons.wikimedia.org/wiki/File:Amazon_Prime_logo_(2024).svg ({{PD-textlogo}}, {{Trademarked}}); amazon.com serves a raster' },
  'Prime Video': { file: 'primevideo.svg', w: 846, h: 266, wide: true, src: 'https://commons.wikimedia.org/wiki/File:Prime_Video_logo_(2024).svg ({{PD-textlogo}}, {{Trademarked}}); primevideo.com serves a raster' },
  'HBO Max': { file: 'hbomax.svg', w: 1091, h: 173, wide: true, src: 'https://commons.wikimedia.org/wiki/File:HBO_Max_May_2025_(Horizontal).svg ({{PD-Textlogo}}, {{Trademarked}}); current HBO Max wordmark; hbomax.com serves a raster; Simple Icons hbomax still draws the 2025 Max logo' },
};
const MONO = {}; // letter badges: none left
const all = Object.values(si).filter((x) => x && x.slug);
const out = {};
for (const [svc, slug] of Object.entries(SI)) { const i = all.find((x) => x.slug === slug); if (!i) throw new Error(`no simple-icon ${slug}`); out[svc] = { kind: 'si', slug, hex: '#' + i.hex, path: i.path, title: i.title }; }
for (const [svc, k] of Object.entries(KIT)) out[svc] = { kind: 'kit', ...k };
for (const [svc, [l, bg, fg]] of Object.entries(MONO)) out[svc] = { kind: 'mono', l, bg, fg };
writeFileSync(new URL('../src/scan-logos.json', import.meta.url), JSON.stringify({ simpleIcons: ver || '', logos: out }, null, 1));
console.log(Object.keys(out).length, 'services');
