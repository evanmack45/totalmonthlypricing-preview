// Square-safe recrops of press-kit marks that read small in the 40/48px badge (Dash live review, 11/27).
// Same paths as the source file, only re-framed: no redrawing, no new shapes, no colour change.
// Run: node scripts/recrop-logos.mjs   (writes src/scan-assets/logos/*-sq.svg)
import { readFileSync, writeFileSync } from 'fs';
const dir = new URL('../src/scan-assets/logos/', import.meta.url);
const body = (f) => readFileSync(new URL(f, dir), 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// HBO Max horizontal wordmark (6.3:1) -> "HBO" over "max" (1.7:1). Column gap measured at x 420-448 of 1091 (viewBox -202.362 334.267 1090.76 173.06).
{
  const g = body('hbomax.svg'), X0 = -202.362, Y0 = 334.267, H = 173.06, hbo = 420, maxX = 448, maxW = 1090.76 - 448, gap = 46;
  const W = maxW, T = H * 2 + gap;
  writeFileSync(new URL('hbomax-sq.svg', dir), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(2)} ${T.toFixed(2)}" width="${W.toFixed(0)}" height="${T.toFixed(0)}">`
    + `<svg x="${((W - hbo) / 2).toFixed(2)}" y="0" width="${hbo}" height="${H}" viewBox="${X0} ${Y0} ${hbo} ${H}">${g}</svg>`
    + `<svg x="0" y="${(H + gap).toFixed(2)}" width="${maxW.toFixed(2)}" height="${H}" viewBox="${(X0 + maxX).toFixed(3)} ${Y0} ${maxW.toFixed(2)} ${H}">${g.replace(/\bid="([^"]+)"/g, 'id="$1-b"')}</svg></svg>\n`);
  console.log('hbomax-sq.svg', W.toFixed(0), T.toFixed(0));
}
// ChatGPT blossom: the file has ~17% empty margin on every side; tighten the viewBox to the drawn bbox (118.56 119.96 484.14 479.82).
{
  const s = readFileSync(new URL('chatgpt.svg', dir), 'utf8').replace(/viewBox="0 0 721 721"/, 'viewBox="116 117 489 486"').replace(/width="721"/, 'width="489"').replace(/height="721"/, 'height="486"');
  writeFileSync(new URL('chatgpt-sq.svg', dir), s);
  console.log('chatgpt-sq.svg 489 486');
}
