# DukaanScan AI — HackSprint PS42

Existing merchant studio extended with a secure Gemini backend, structured image-analysis suggestions, evidence, uncertainty and missing-field review. Merchant pricing, five regional ad templates, device voice and JSON export remain available.

**Integration status:** the real image-to-catalog flow passed twice on 17 October 2026 using Gemini Developer API and `gemini-3.5-flash-lite`, with the supplied saree photo. Automated browser tests exercised review, merchant edits, test-price preservation and JSON export using live responses. This verifies this demo path, not general model accuracy. Vertex AI, Storage, BigQuery and deployment remain unverified. AI regional ad generation and document input are not implemented yet. Credentials remain in the ignored local `.env`, never in source.

## Run

Requires Node.js 22 or newer.

```sh
npm ci
cp .env.example .env
npm start
```

Open http://127.0.0.1:3000. With AI disabled, use **No photo? Try a sample saree** or upload a photo and choose **Use category sample draft**.

For the original static-only demo, `python3 -m http.server 8000` still works. It has no AI endpoint; sample drafts remain functional. Do not expose that static server publicly from a directory containing `.env`; use the Node server's allowlisted assets instead.

## Configure real Gemini

See [Google Cloud setup](docs/GOOGLE-CLOUD-SETUP.md). Vertex AI with ADC is the default provider; the backend also supports an explicitly selected Gemini API key provider for a first live test. Configure credentials only locally or through cloud service identity. No credential goes into frontend code.

Required Vertex settings: `AI_ENABLED=true`, `GEMINI_PROVIDER=vertex`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GEMINI_MODEL`, plus working ADC. A configured status is not a successful access check. Model ID and location must be verified in the target account.

## Workflow

1. Upload JPEG, PNG or WebP up to 10 MB. Optional seller notes provide fragmented text context.
2. Choose **Analyze photo with Gemini**. The image and notes are sent to the backend and selected Google service. No app-side image storage is performed.
3. Review suggested title, description/category, visible attributes, evidence, uncertainty and missing fields. Apply selected suggestions.
4. Edit and confirm material, condition, price and other details. Same-product AI/sample regeneration preserves merchant price; a new upload starts a new product and clears the old price.
5. Select a language and edit the existing template ad. These templates are not AI translations; the title stays as written.
6. Confirm the details, preview device voice if available, then export JSON.

If AI is unavailable, the app explains the failure and offers explicitly labelled sample copy. It never presents fallback content as image analysis. The original listing is not silently replaced by an AI response.

## Data and safeguards

- Server decodes supported images, bounds file size/pixel count, removes metadata and resizes to at most 2048 pixels per side for analysis. Small labels may become less legible and require seller confirmation.
- Uploads are held in memory; there is no bucket/database persistence. Provider-side data handling is governed by the selected Google service/account terms.
- Schema validation and evidence-reference checks reject malformed results, but cannot prove factual correctness. All claims need merchant review.
- AI has no price field or ability to overwrite merchant pricing.
- Browser renders returned text as text. Backend serves only three public files and returns sanitized errors.
- Timeouts, two concurrent request slots and a per-process request limiter bound the demo workload. Public/multi-instance production deployment needs additional access controls.
- Export `dukaan-scan.catalog-draft.v2` includes analysis provenance and reviewed fields; it remains an integration draft, not an ONDC submission. Images are not embedded in JSON.
- Reloading the page loses unsaved drafts, as in the original demo.

## Tests

```sh
npm test
npx playwright install chromium
npm run test:browser
# Requires the backend running, real credentials and a real product image:
npm run test:live -- /absolute/path/product.jpg
```

Backend and browser tests use synthetic images and explicitly mocked model responses. They verify validation, error handling, edit/price safety, review, templates and exports. They do not measure model accuracy or validate credentials. Voice availability and pronunciation require a device with installed language voices.

## Files

- `index.html`, `style.css`, `app.js`: preserved merchant UI with analysis/review additions.
- `server/`: configuration, upload endpoint, Gemini adapter and response validation.
- `shared/analysis-contract.js`: authoritative model-output JSON Schema.
- `tests/`: backend, adapter and browser regressions.
- `scripts/test-live.js`: real-image endpoint smoke test; never prints secrets or uploaded data.
- `docs/GOOGLE-CLOUD-SETUP.md`: account actions, service requirements and verification gates.

## Remaining milestones

1. Real-image Gemini milestone passed with one supplied photo; expand evaluation to the team's other products.
2. Add grounded regional AI content only after milestone 1 passes.
3. Verify project access and add private Cloud Storage / meaningful BigQuery events where feasible.
4. Test the actual demo path and disclose precisely which integrations passed.

PS42's full text/image/document ambition also needs a tested document-input path. This increment accepts an image and seller text; it does not claim document support.

## Live verification details

`server/gemini-schema.js` maps the strict application JSON Schema to Gemini's native `responseSchema`, including nullable values. The full contract is still independently enforced by Ajv. Sending the full JSON Schema directly produced a live invalid-argument error; the native mapping passed the complete image workflow.

The original model candidate `gemini-2.5-flash` was unavailable to new users; `gemini-3.8-flash` passed text generation but returned high-demand errors for image requests during testing. The tested local configuration now uses `gemini-3.5-flash-lite`. No automatic model switching is hidden in the app.

To repeat the real browser test (this sends the image to Google and simulates merchant actions with a test price):

```sh
node scripts/test-live-browser.js /absolute/path/product.jpg /absolute/path/test-results-directory
```

The exported `LIVE-TEST-CATALOG.json` contains simulated approval and the test price INR 1234.56, not an actual merchant-approved sale price. `PRODUCT-DRAFT.json` is captured separately before those actions, with price null and review pending.

## Pricing and positioning (catalog v3)

See [pricing implementation and test report](docs/PRICING.md). Cost/margin advice is available without Gemini; optional Gemini questions use the existing configuration. No market data is preloaded, and no price is inferred from a photo. Recommendations never overwrite a seller price. Price approval is separate from final catalog review. New caption/WhatsApp copy is template-based. Real API tests passed; current rendered browser verification remains outstanding.

## Advanced textile intelligence

See [textile upgrade report](docs/TEXTILE-UPGRADE.md). New vision responses include structured observations and separately labelled material hypotheses; seller-reviewed marketing supports the five existing languages. No Instagram publishing, craft database or market feed is connected. Live schema checks passed across saree, pottery and jewellery inputs; material truth and rendered UI still require review.

## Final milestone demo

See [final milestone implementation and setup report](docs/FINAL-MILESTONES.md). Drafts and uploaded photos now persist locally in IndexedDB; wait for the saved status before closing. Edits survive regeneration cancellation/failure. Download Creative uses the actual uploaded photo. Pricing accepts margins from 0% up to, but not including, 100%.

Instagram publishing, Cloud Storage and BigQuery show truthful setup-required/not-connected states; they are not integrated services yet. Existing Gemini API-key analysis remains available. The report contains the demo sequence, exact missing setup and test evidence.
