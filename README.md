# Total Monthly Pricing (noindex preview)

Tick the subscriptions you pay. A thermal-style receipt prints your monthly total and what you will pay each company by age 80.

- `data/prices.json`: every price, with its official source URL and the date it was checked. Edit this file to update a price.
- `node build.mjs`: builds `docs/` (served by GitHub Pages). No dependencies.
- `src/`: CSS, JS, fonts (Instrument Sans and Departure Mono, both SIL OFL 1.1; licenses in `src/fonts/`).

Nothing is stored. Picks live in the page and in the URL hash when you copy a link. No cookies, analytics, accounts or third-party requests.
