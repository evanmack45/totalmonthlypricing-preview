# totalmonthlypricing.com STATUS

- Preview: https://evanmack45.github.io/totalmonthlypricing-preview/
- Repo: https://github.com/evanmack45/totalmonthlypricing-preview (Pages from main /docs, cname null)
- State: noindex GitHub Pages preview. Not on the custom domain. No DNS, Afternic or registrar change.

## Wow pass, 2026-11-25 8:28 AM CT

A stranger landing here needs a reason to screenshot the receipt and send it. After the diner-b art pass, the lifetime total — the only number anyone would actually forward — still sat below the fold, after the itemized lines. The saved PNG was a faithful thermal print that started with a header and buried "$21,823.20" in the middle, and the URL at the bottom was clipped mid-host.

Two changes, typography only (no new art generated):

1. Reveal: the receipt now opens with an "Amount due" block, "To age 80" plus the rust lifetime total (`#b2300b` on `#fffdf6`, 6.21:1) and "That is $1.18 a day, every day." That number is on the 390 and 1280 folds. The save button names it ("Save your $21,582.00 receipt").
2. Share card: the PNG leads with the same huge lifetime total and daily rate, then the marked lines as proof, then monthly/yearly. The public URL is wrapped on its own lines so it is not clipped. "Thank you for subscribing" stays as the closer.

Share footer and Copy link no longer bake localhost: a CANONICAL constant (`https://evanmack45.github.io/totalmonthlypricing-preview/`, to become `https://totalmonthlypricing.com/` at go-live) is used on localhost, 127.0.0.1, or file: URLs.

Art request for Dash (not generated): a coffee-ring stain for the share card, no text, no likenesses — `/workspace/sites/totalmonthlypricing.com/art/requests-r2.md`.

Gate (390+1280, qa/wow-v1 and qa/wow-v1-1280): PASS, no P0/P1. Lighthouse mobile performance 99 / accessibility 100 / best-practices 100, CLS 0, LCP 1.8 s, SEO 66 (intended noindex). Impeccable 0 at both viewports. e2e ALL PASS (62), including no-localhost footer and copied-link checks on the dev server.

Folds (opened): qa/art-folds/fold-390.png, fold-1280.png. Share card: qa/art-folds/receipt-sample.png (also qa/receipt-sample.png).
