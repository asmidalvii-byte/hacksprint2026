# Final milestones — actual implementation and demo readiness

Updated 2026-10-17. This report supersedes older statements about in-memory-only drafts and a 95% margin cap. Existing Gemini/textile/listing modules were reused, not rebuilt.

## Run

Node 22+ is required. In the repository run `npm ci`, copy `.env.example` to `.env` only if `.env` does not already exist, configure Gemini locally, then run `npm start`. URL: http://127.0.0.1:3000/ . Never replace an existing configured `.env` with the example. Server must remain local; authentication and multi-merchant isolation are not implemented for public deployment.

## What changed

- Price advisor displays category, seller-reported material/dimensions/workmanship and explicitly unverified material hypotheses. Guesses do not become pricing facts.
- Calculation is shown with actual numbers: cost / (1 − margin percentage / 100). A cost of 800 and margin 20% produces 1000; 99% is accepted, negatives and >=100% rejected. This is gross margin, not markup. Include all per-unit costs. No comparable dataset is loaded: market comparison is explicitly unavailable. No competitor price or citation was invented.
- Existing seller price is never overwritten by calculation or API failures. Acceptance fills only an empty price field. Seller editing, rejection, price approval and catalog export remain.
- Existing Instagram caption/hashtags/preview and language selector are reused. Product edits preserve the social draft but invalidate its review. Regenerating an edited or stale draft asks before replacement; cancelling or a failed API request preserves edits.
- Optional price inclusion appends only the currently approved seller price. Changing price/context removes inclusion and review; the base editable caption is not rewritten.
- Copy Caption copies caption plus hashtags. Download Creative requests a download of the actual local uploaded image, not an invented creative; it refuses when no image exists. The UI says download requested, not that the OS completed it. WhatsApp opens an encoded draft; it never claims the message was sent. Export Draft downloads JSON. Post to Instagram reports setup required; no remote post occurs.
- IndexedDB stores one current draft and its image atomically, on this device/browser. Autosave follows edits; asynchronous AI/pricing results also trigger saves. Save Draft provides an explicit save and completion status. Wait for the saved status before closing or refreshing: a tab closed before a transaction completes may lose the newest edit. Restore preserves price/text/image, but requires reapproval before sharing. Storage errors leave the live editor intact and instruct export; private-mode quotas, browser-data clearing and multi-tab last-writer-wins remain limitations.

## Configuration actually inspected

Only the API-key Gemini route is configured (`GEMINI_PROVIDER=api-key`). No Google Cloud project/location, explicit credentials path, default local ADC file, Storage bucket, BigQuery dataset/table, Instagram token/account/version or Meta app credentials were present.

`GET /api/integrations` reports configuration/setup state only, never successful connection. It returns no token values. `POST /api/instagram/publish` requires explicit approval and returns HTTP 503 / `INSTAGRAM_SETUP_REQUIRED`; this is the permitted missing-credentials fallback, not a publishing implementation. Supplying environment variables alone does not enable publishing. Cloud Storage and BigQuery adapters are not implemented or connected in this build. The existing Vertex adapter remains available but is not selected or tested live.

## Official Instagram setup still required

Use a professional Business or Creator account and a Meta developer app configured for the chosen official login route. For Instagram Login, Meta documents `instagram_business_basic` and `instagram_business_content_publish`; this route does not require a linked Facebook Page. Follow the app's access/review requirements for the accounts being served. Source: [Meta's official Instagram Login collection](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login).

Authorize the actual merchant account through Meta; never collect an Instagram password. Store the resulting token server-side. Reserved environment names are `INSTAGRAM_ACCOUNT_ID`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_API_VERSION`, `META_APP_ID`, `META_APP_SECRET`; set the supported API version shown by the authorized Meta app, not a guessed version. Tokens/secrets must remain in local environment or a secret manager, never drafts or browser bundles.

Remaining implementation after authorization: an official publishing adapter, account/permission checks, supported image validation, a seller-approved image URL accessible to Meta, container creation/status/publish flow, persistent idempotency and uncertain-outcome reconciliation, and confirmed media ID/permalink before success. A local blob URL is not a hosted asset. Keep private images private until the seller explicitly approves the publishing exposure. Tests with expired tokens, missing scopes, unsupported media and actual API-confirmed posts are outstanding. Current duplicate clicks are disabled while the setup check runs, and no post can be created.

## Google Cloud setup still required

Use an authorized Google Cloud project with billing where required. Enable the intended service APIs in that project, and use Application Default Credentials for local development or workload identity/attached service identity in deployment. No credentials need to be changed to use the working local demo. ADC reference: https://cloud.google.com/docs/authentication/provide-credentials-adc .

### Vertex AI

Existing adapter already uses `GoogleGenAI({vertexai:true, project, location})`. After the project administrator authorizes access, select a model and region supported by that project. Set `GEMINI_PROVIDER=vertex`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GEMINI_MODEL` and `AI_ENABLED=true`, then restart and run a real image test. Enable `aiplatform.googleapis.com`; grant the intended identity appropriate Vertex AI access (typically `roles/aiplatform.user`). Configure ADC using `gcloud auth application-default login` and the authorized quota project. Do not switch the current working API-key route until these prerequisites are verified. Model and location have intentionally not been guessed.

### Cloud Storage

Reserve `GCS_BUCKET` and `GOOGLE_CLOUD_PROJECT`. Create a bucket with uniform bucket-level access and public-access prevention. Grant narrowly scoped object-create access for uploading, and object-viewer access only where private downloads are needed. Cloud Storage documents upload permissions and overwrite preconditions: https://cloud.google.com/storage/docs/uploading-objects .

Remaining backend adapter must reuse existing MIME/signature/size/decode checks, strip metadata, use UUID object names and generation-match-zero preconditions, and never change ACLs to public. Authenticated downloads must be authorized and failures must preserve the local photo. No upload or download was attempted in this milestone, and no service-account key was requested or generated.

### BigQuery

Reserve `BIGQUERY_DATASET`, `BIGQUERY_TABLE`, `BIGQUERY_LOCATION` and `GOOGLE_CLOUD_PROJECT`. Enable `bigquery.googleapis.com`, create the dataset/table in the chosen location, and grant the service identity dataset-scoped write permissions plus job-user permissions when running query jobs. Proposed minimal fields: random catalog ID, category, workflow status, approved-price amount/currency and timestamp. Exclude images, free-text notes, captions, access tokens and personal details.

Remaining backend adapter must use typed/parameterized SQL values (and validated administrator-configured table identifiers), opt-in workflow writes, safe errors and idempotency. Parameterized query reference: https://cloud.google.com/bigquery/docs/parameterized-queries . No dataset/table was created, no query ran, and no write was simulated.

These are honest remaining cloud tasks, not completed integrations. Missing cloud setup does not affect local analysis, editing, pricing, persistence or exports.

## Verification

- `npm test`: **46 passed, 0 failed**. Existing 36-test suite retained, plus expanded margin validation, IndexedDB round-trip, persistence-controller restoration, regeneration cancellation/failure, approved-price inclusion, sharing payload, creative-byte selection, integration-secret exclusion and HTTP setup-required tests.
- `fake-indexeddb` is a pinned test-only dependency. Persistence tests use its IndexedDB emulator; UI-handler tests use a simulated DOM. Clipboard/window/download tests verify callbacks and payloads, not real browser/OS delivery.
- Existing Gemini error tests use mock SDK responses. New Instagram tests exercise the real local HTTP fallback, not Meta. No Google Cloud service is mocked as successfully connected.
- No new paid Gemini requests in this milestone. Earlier recorded live tests succeeded for the saree, pottery, jewellery, degraded image and Hindi marketing using `gemini-3.5-flash-lite`. They prove integration/schema transport, not attribute truth or translation accuracy.
- Syntax checks, `git diff --check` and pre-push secret scan pass. npm install audit reported zero vulnerabilities in the installed dependency set.
- Rendered browser tests remain unexecuted because the earlier local-browser security block still applies. Browser rendering, real downloads, clipboard permissions, WhatsApp navigation and actual refresh behavior need manual acceptance. No alternate browser was used to bypass the block.

## Demo sequence

1. Start the local server, upload a real product photo, Generate my listing, review colour/evidence/material hypotheses. Existing sample fallback is available if Gemini is down.
2. Open Optional pricing & positioning. Enter total unit cost 800 and margin 20; show calculation 1000 and Market comparison unavailable. Do not present these demo inputs as the real product's cost.
3. Accept into an empty price field, edit if desired, and approve the actual seller price. Review the listing.
4. Select an existing supported language and generate sharing drafts. Edit caption/hashtags; open Instagram preview. Optionally include the approved seller price.
5. Save Draft and wait for Saved on this device. Refresh to demonstrate photo, price and caption restoration. Reapprove price if used, marketing and final listing.
6. Demonstrate Copy Caption, Download Creative, Export Draft and WhatsApp draft opening. Do not claim WhatsApp sent a message.
7. Click Post to Instagram and show the setup-required response. Show genuine Cloud Storage/BigQuery/Vertex status below it.
8. Export the catalog JSON and inspect separate seller price, advice, evidence and pending/approved review states.
9. Change the listing or price and demonstrate that social edits survive but approval is invalidated. Cancel regeneration to demonstrate edit protection.

## Changed files

Pricing: `shared/pricing.js`, `shared/pricing-contract.js`, `pricing-ui.js`, `server/app.js`, `index.html`, `tests/pricing.test.js`.
Draft/persistence: `intelligence-ui.js`, `draft-storage.js`, `draft-persistence.js`, `app.js`, `index.html`, `package.json`, `package-lock.json`.
Honest integration state: `server/integrations.js`, `server/app.js`, `.env.example`.
Tests/docs: `tests/draft-storage.test.js`, `tests/integrations.test.js`, `tests/pricing-ui.test.js`, `tests/browser/final-milestones.spec.js`, README and this report.

Changes are committed and pushed under the user's standing authorization to push completed, tested changes. Earlier implementation reports' no-push statements describe their original execution times, not current Git status.
