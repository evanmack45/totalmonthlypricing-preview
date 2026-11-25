# totalmonthlypricing.com STATUS

- Preview: https://evanmack45.github.io/totalmonthlypricing-preview/
- Repo: https://github.com/evanmack45/totalmonthlypricing-preview (Pages from main /docs, cname null)
- State: noindex GitHub Pages preview. Not on the custom domain. No DNS, Afternic or registrar change.

## r2 coffee ring, 2026-11-25 8:46 AM CT

Dash's r2 art (`art/incoming/r2/coffee-ring.webp`, 800×800 RGBA, ~720px ring, no text or marks) is wired as a handled-receipt stain, not a logo. The source is larger than the 600px spec, so both placements scale it at draw/layout time.

Why: a lifetime total on a pristine thermal print is a screenshot; a lifetime total on a receipt that looks like it sat under a diner mug is something someone forwards.

- Share card: the 800 WebP is drawn at `800 * (600/720)` CSS px, lower-left and mostly off the paper, after the fill and perforation and before the torn edge and type, at 40% opacity. Placement is clamped below the hero block so the rust `#b2300b` lifetime total and the daily-rate line never sit on the stain (measured: 0 overlapping rust or muted pixels). Ink that does cross the arc stays ≥6.86:1 (budget 4.5:1).
- On-page receipt: a 400×400 WebP (43.5 KB) with width/height set, `alt=""`, `aria-hidden`, absolutely positioned lower-left behind the type (`z-index: 0`). It is clipped by the torn-edge mask and kept below the fine-print block so muted `#57555f` copy stays ≥5.72:1 and the rust total stays on paper at 6.21:1.

Checked in place at 390 and 1280: uneven, broken density, a corner arc rather than a target or a neatly printed circle. Kept. No likenesses, no baked-in letters.

Gate (390+1280, qa/r2-ring): PASS, no P0/P1. Lighthouse mobile performance 99 / accessibility 100 / best-practices 100, CLS 0, LCP 2.1 s, SEO 66 (intended noindex). Impeccable 0 at 390×844, 1280×800, and the static file. Local e2e ALL PASS (62), including no-localhost footer and copied-link checks on the dev server.

Folds (opened): qa/art-folds/fold-390.png, fold-1280.png. Share card: qa/art-folds/receipt-sample.png, regenerated from the live preview after push.

## Wow pass, 2026-11-25 8:28 AM CT

A stranger landing here needs a reason to screenshot the receipt and send it. After the diner-b art pass, the lifetime total — the only number anyone would actually forward — still sat below the fold, after the itemized lines. The saved PNG was a faithful thermal print that started with a header and buried "$21,823.20" in the middle, and the URL at the bottom was clipped mid-host.

Two changes, typography only (no new art generated):

1. Reveal: the receipt now opens with an "Amount due" block, "To age 80" plus the rust lifetime total (`#b2300b` on `#fffdf6`, 6.21:1) and "That is $1.18 a day, every day." That number is on the 390 and 1280 folds. The save button names it ("Save your $21,582.00 receipt").
2. Share card: the PNG leads with the same huge lifetime total and daily rate, then the marked lines as proof, then monthly/yearly. The public URL is wrapped on its own lines so it is not clipped. "Thank you for subscribing" stays as the closer.

Share footer and Copy link no longer bake localhost: a CANONICAL constant (`https://evanmack45.github.io/totalmonthlypricing-preview/`, to become `https://totalmonthlypricing.com/` at go-live) is used on localhost, 127.0.0.1, or file: URLs.

Art request for Dash (not generated): a coffee-ring stain for the share card, no text, no likenesses — `/workspace/sites/totalmonthlypricing.com/art/requests-r2.md`.

Gate (390+1280, qa/wow-v1 and qa/wow-v1-1280): PASS, no P0/P1. Lighthouse mobile performance 99 / accessibility 100 / best-practices 100, CLS 0, LCP 1.8 s, SEO 66 (intended noindex). Impeccable 0 at both viewports. e2e ALL PASS (62), including no-localhost footer and copied-link checks on the dev server.

Folds (opened): qa/art-folds/fold-390.png, fold-1280.png. Share card: qa/art-folds/receipt-sample.png (also qa/receipt-sample.png).
