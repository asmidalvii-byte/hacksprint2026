# Advanced textile identification — implementation report

Implemented 2026-10-17 in the existing DukaanScan app. No rebuild, no new dependencies, no secrets printed, no GitHub push.

## Files changed in this upgrade

- `shared/textile-contract.js`: structured observation groups, material/regional hypotheses, listing enrichment, seller facts/questions and pending review.
- `shared/analysis-contract.js`, `server/gemini-schema.js`: backward-compatible read schema and required intelligence for new Gemini requests; native Gemini schema mapping retained.
- `shared/catalog-intelligence-contract.js`: distinct export contract for seller-edited identity, actual pricing and reviewed marketing.
- `server/gemini.js`: evidence-focused textile prompt and output budget; no photo-based material facts or price estimates.
- `server/validate-analysis.js`, `server/validate-textile.js`: evidence-reference, alternative-explanation, seller-source and unsupported factual-copy checks.
- `server/marketing.js`, `server/app.js`: reviewed-listing marketing endpoint, five-language schema, safe errors, origin/body/rate/concurrency limits; API analysis version 1.1.
- `intelligence-ui.js`, `app.js`, `pricing-ui.js`, `index.html`, `style.css`: one-click first draft, expandable intelligence, optional pricing panel, editable social drafts/preview, approval, copy/download and WhatsApp draft opening. Existing prices are preserved. Reanalysis of an existing listing still requires explicit application.
- `tests/fixture.js`, `tests/textile.test.js`, `tests/pricing-ui.test.js`, browser tests and live scripts: regression/evidence/schema/UI-handler coverage.
- `docs/TEXTILE-UPGRADE.md`, README: usage and limitations.

## Working flow

1. Upload a photo and select Generate my listing. A first successful response populates a draft automatically; it remains unapproved. Existing edited drafts are not overwritten by reanalysis.
2. Review/edit title, description, seller-confirmed material, condition and price. Material candidates remain separate hypotheses and never populate confirmed material or pricing facts.
3. Expand evidence to inspect micro-texture, reflection, drape, opacity, saree body/border/pallu, condition, image limitations, hypotheses, alternatives and high-value seller questions. Unknown material does not block listing creation.
4. Review the listing, then Generate Instagram & sharing drafts in the selected Hindi, Tamil, Telugu, Kannada or Bengali language. The backend receives only reviewed title/description, not hypotheses. Current seller-approved price is appended locally if present. Regional translation still needs merchant review.
5. Edit captions, hashtags, marketplace description, WhatsApp text, voice script and alternatives. Preview the current photo with its caption. Approve marketing and final listing before copy, download or opening a WhatsApp draft. WhatsApp opening does not send a message. Device speech playback remains available; apply the new voice script and review again before playback.
6. Export catalog v3: original image analysis, structured product intelligence, current merchant product fields, separate pricing and social marketing. Original observations/hypotheses remain traceable; seller editing does not retroactively prove them true. The export enrichment has a separate schema because the model is not allowed to choose pricing or approval states.

Sample generation, local regional templates, offline cost calculations and JSON export remain. AI errors do not silently pass malformed output to the editor. Marketing outages fall back to explicitly labelled local templates.

## Actual verification

- `npm test`: **36 passed**, no failures. Includes existing image/backend regressions, pricing, hypotheses with evidence and alternatives, unsupported claims, low-quality/ambiguous schema fixtures, pottery/jewellery fixtures, stale asynchronous responses, seller editing, approvals, marketing fallback and detailed JSON export schema.
- Synthetic fixtures cover cotton-like, silk-like, synthetic and blended hypotheses; these are **not labelled photographs or material-classifier accuracy benchmarks**.
- Mock SDK tests cover malformed output, truncation, invented numbers, changed protected pricing fields, authentication/quota/network failures. Five-language marketing contract tests are mocked.
- Live configured model: **gemini-3.5-flash-lite**, existing local API-key route.
- Live original new saree photo: HTTP 200, required intelligence accepted by native Gemini schema and application validation. Material suggestions remain unverified. No earlier saree image was reused.
- Live low-resolution/blurred derivative of that photo: HTTP 200; explicitly reported low resolution, blur and compression limitations.
- Live public pottery photograph: first response rejected (HTTP 502); diagnostic showed a valid general material hypothesis incorrectly rejected by an overly broad non-textile rule. Fixed distinction between non-textile material hypotheses and textile fibre candidates, and tightened age/specific-material claims. Final endpoint retest HTTP 200, category `pot`, applicability `non_textile`.
- Live public jewellery photograph: final endpoint HTTP 200, category `jewelry`, applicability `non_textile`.
- Live Hindi marketing: HTTP 200, source Gemini. Used synthetic reviewed facts to test transport/schema; this was **not actual seller approval** of the uploaded photo and does not validate translation accuracy. Other four languages have mocked contract coverage, not live human translation review.
- Syntax checks and `git diff --check` passed.
- Browser tests updated/added but **not executed** in this task because the earlier browser security block on local app access remains applicable. No alternate browser was used to bypass it. DOM-handler tests are not rendered browser tests. End-to-end UI rendering, real downloads, clipboard, WhatsApp launch and visual review remain outstanding.

Live artifacts: `outputs/textile-upgrade/LIVE-TEXTILE.json`, `LIVE-MARKETING-TEST.json`, `LIVE-RESULT.json`, `CATEGORY-TESTS.json`, `pottery.json`, `jewellery.json`, `degraded-saree.json`. `POTTERY-DIAGNOSTIC.json` is a rejected diagnostic response, not an approved listing.

## Test image provenance

Only bytes were sent to Gemini; source metadata, museum dates/materials and filenames were not provided as product facts.

- User-provided `WhatsApp Image 2026-10-17 at 11.13.59 AM.jpeg`: unverified composition; real merchant product input.
- Ceramic jug, Metropolitan Museum of Art, 2009.250; Wikimedia CC0 source: https://commons.wikimedia.org/wiki/File:Ceramic_jug_MET_2009_250.jpg . Museum image used only for cross-category regression, not market pricing or authenticity verification.
- Bead necklace by Leonard Kisuu; Wikimedia attribution/share-alike source and license details: https://commons.wikimedia.org/wiki/File:Bead_necklace.jpg . Used only for cross-category regression. No downloaded third-party source images were added to the repository.

## Limits and remaining integrations

Photo analysis cannot establish fibre purity, blend percentages, handloom production, precious-metal content, age, origin, certification or inclusion of accessories. Qualitative confidence is not a calibrated probability. Semantic model errors remain possible even when schema/evidence checks pass; text guards are deliberately conservative and are not a universal truth detector. Seller-provided evidence is an assertion, not independent verification. Unsupported results can be rejected and require a retry or sample fallback.

No regional-craft database, fibre-testing service, verified market-price feed, transaction dataset or Instagram publishing integration is connected. Pricing continues to use confirmed seller cost/margin or manually reviewed comparable records; the market dataset remains empty. No reliable market range is available for the saree until sufficient facts and comparable data are supplied.

No additional credentials are needed for implemented Gemini features. Direct Instagram publishing would require an authorized account integration and explicit publishing approval; it is intentionally unavailable. Physical fibre verification requires appropriate documentation or professional testing. No home burn-test instructions are generated.

## Manual acceptance checks still required

Save any current draft before refreshing the running app: editor state is in memory. Try a new photo, check the main body colour separately from the border, inspect hypotheses and missing details, edit the listing, enter a seller price, generate/edit marketing, approve both marketing and final listing, and export. Verify price preservation on reanalysis and that a new upload clears old product-specific state. Run the browser suite when browser access is permitted: `PLAYWRIGHT_BROWSERS_PATH=../playwright-browsers npm run test:browser`.
