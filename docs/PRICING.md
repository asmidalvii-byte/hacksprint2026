# Pricing upgrade — implementation and evidence

Implemented locally on 2026-10-17. No GitHub push. No new dependencies or credentials.

## Sources actually available

- Existing API-key Gemini connection; configured model `gemini-3.5-flash-lite`. Pricing uses structured output, not search grounding.
- Seller-entered facts and costs. These are seller assertions, not independent verification.
- Web research is available during development, not integrated into the application. Taneira's public retailer catalog was discoverable: https://www.taneira.com/shop/collections-sarees . It contains material- and construction-specific products. No prices were imported: the uploaded saree's fabric, technique, dimensions, inclusions, brand equivalence and actual sales channel are not confirmed. Search snippets are not verified product-price records.
- No market-data API, verified pricing dataset, transaction-price data or category-level benchmarks are configured. `data/market-prices.json` intentionally contains an empty array. Never insert test fixtures into it.

## Use

Refresh the local app at http://127.0.0.1:3000/ after saving/exporting any current work; refresh clears in-memory editor state. Upload/apply image suggestions or use a sample. Expand the listing and find Pricing & positioning. Enter only known seller facts; leave unknown fields blank. Set currency before entering a seller price. Supply total unit cost and desired gross margin if known. Gemini questions are optional and transmit the pricing inputs to the configured backend/Google service.

Calculate pricing advice. Unknown market prices remain null. Accept only copies a recommendation into an empty price field; an existing price can only be changed by the seller editing it. Rejection preserves the price. Acceptance does not approve the listing. Check the separate price approval box before generating priced marketing, and review the whole listing before export. Any pricing-input change invalidates the estimate and approvals; new products also clear product-specific cost inputs. Seller price edits clear its approval and generated marketing.

The new caption and WhatsApp message use English templates and seller-reviewed fields; they are not Gemini-generated marketing. Existing regional template ads and device voice remain. Intended positioning is neutral unless supported by reviewed comparables. Premium price positioning never proves premium material, quality or value. Discounts are calculations only, based on a seller-provided genuine original price, and are never automatically applied or advertised.

## Calculation and evidence rules

- Gross margin is a percentage of selling price, not markup: price = total cost / (1 − margin/100). Require positive cost and a supplied margin between 0 and 95%. Include all unit costs; percentage-based fees require separate costing. No assumed margin, taxes, fees or currency conversion.
- Market range requires at least 3 reviewed matching listings from at least 2 retailer hostnames, observed within 30 days. Match currency, market, location, channel, category, subcategory, material, dimensions, technique, inclusions and condition. Current exact matching is deliberately conservative; equivalent wording needs human normalization.
- Required record fields: title, url (HTTPS), listed_price, currency, market, location, sales_channel, category, subcategory, material, dimensions, workmanship, accessories, condition, observed_at (ISO timestamp), review_status="verified", source_type="retailer_listing", reviewer, comparability_notes. Source review is manual; a "verified" flag is a maintainer assertion, not automated fact checking. Related retailer domains should be reviewed for independence. No browser or model can submit these records through the API. Restart backend after dataset edits.
- Low/typical/high mean min/median/max of eligible listed asking prices, not confidence bounds or completed sales. These statistics do not prove a product will sell at that price. Medium confidence at most; low without sufficient comparables.
- Recommendation prioritizes supplied cost/margin arithmetic, otherwise the comparable median. It is not profit optimization or a validated market recommendation. Both cost result and market range remain visible. Without either basis, recommendation is null. No unsupported category-price guess.

## Implementation

`shared/pricing.js` contains deterministic rules also used for static/offline fallback. `shared/pricing-contract.js` defines the Ajv pricing schema. `server/pricing.js` runs optional Gemini assistance with the full mapped schema; it rejects changes to numbers, sources, confidence, timestamps, seller approval and other protected fields. Only additional factors and questions are accepted, and need seller review. Safe fallback retains deterministic calculations after API failures or invalid responses. Existing image-analysis schema and endpoint are unchanged.

`POST /api/pricing` accepts whitelisted facts, currency, market, costs, margin and optional use_ai. It rejects client-provided comparables/prices, shares request/concurrency limits and origin controls, and never returns upstream secrets. No arbitrary URL fetching. Dataset and credentials are not served. `pricing-ui.js` controls review and marketing; `app.js` exports catalog v3 with a separate pricing object and marketing object. The product price remains merchant-owned. Full pricing schema is validated server-side; final seller approval fields are set by editor actions.

Google structured output supports a schema subset; full application validation is retained: https://ai.google.dev/gemini-api/docs/structured-output

## Tests and limits

`npm test`: 26 passed (existing image/backend regression tests, pricing arithmetic/evidence tests and three production UI-handler tests using a simulated DOM). Comparable prices in tests are synthetic and labelled; none are real market research. Gemini error/schema-tampering tests use mocked SDK responses. UI-handler tests use mocked HTTP responses and do not verify rendering or real file downloads.

Live run: `node scripts/test-live-pricing.js /absolute/path/to/new-product.jpeg` used the configured Gemini model through the real backend. Pricing HTTP 200, full pricing schema accepted, protected fields preserved, no market-price numbers produced. Real image regression HTTP 200, source Gemini, merchant review pending. Outputs are in `outputs/pricing-upgrade/`. API success does not verify image attribute accuracy or price accuracy.

Browser tests: added two pricing workflows and updated price approval steps in existing tests. NOT RUN in this task: the prior browser security block prevents local UI access, and no alternate browser route was used to bypass it. End-to-end rendered UI/manual visual review remains outstanding. When browser access is permitted, run `PLAYWRIGHT_BROWSERS_PATH=../playwright-browsers npm run test:browser`, then manually review colours, pricing labels, editing and downloaded JSON. Do not describe this upgrade as fully browser-verified yet.
