# Kriti inventory, Help and voice input — 18 October 2026

## Audit and scope

Inspected the static merchant UI, React welcome page, screen navigation, account middleware, product snapshots/draft persistence, pricing and marketing handlers, server routes, existing migrations, setup guides and tests. The project had seller-owned cloud listings but no inventory table or speech-recognition controller. Instagram backend code exists but its frontend authorization/publishing handoff and live Meta setup remain incomplete. No invented published totals, verification badges or successful support submissions have been added.

UI observation remains a source-level audit and mocked DOM reproduction, not a rendered browser inspection: browser automation was rejected earlier in this session. Desktop/mobile appearance, microphone permissions and actual spoken-language accuracy remain manual acceptance items.

## What changed

- Labelled SVG navigation: Dashboard, Create Listing, My Products, Inventory, Social drafts, Verification, Help & Support, Profile. Uses the existing inline stroke-icon approach in one small shared set; no remote icon service.
- Brand tokens and responsive cards/forms, clear stock badges, loading/error/empty states, product thumbnails and visible selected navigation.
- Dashboard counts come from authenticated database queries: listings, inventory items, low stock and out of stock. Published counts are deliberately absent because the browser does not have a verified publishing summary.
- My Products opens existing cloud drafts after saving current changes. It does not manufacture products for local-demo accounts.
- Inventory: create/read/edit/delete, linked saved product or standalone stock item, name/SKU search, category/status filters, sort, 20-item pagination, quantity/threshold/price/currency/description and timestamps. Photos come from linked saved products using short-lived signed URLs. Standalone stock items have initials instead of an invented photo; standalone image upload is not implemented.
- Help: searchable categorized native expandable FAQs, real navigation, and a downloadable problem-report template. Nothing is submitted to a support backend and no contact address is invented.
- Voice: Speak your description beside seller notes and product description, Start/Stop/Cancel, selected UI language, visible state/transcript feedback, append-only results, editable text, duplicate-result suppression and cancellation on navigation/language changes/page hide/sign-out. Browser recognition is separate from Gemini. Explicit consent can copy the editor description into seller notes for the next photo-analysis request. Photo upload and normal AI review remain required.
- The preceding welcome request is included: the rangoli introduction reaches “Welcome to Kriti” and waits for click/Enter. It no longer automatically advances from that message. Skip/Escape and reduced-motion behavior remain available.

## Bugs fixed / reproduction evidence

1. Language selection built a button containing an interactive speaker span. Inspection confirmed nested interactive controls. They are now separate native buttons in a list-item wrapper.
2. Draft capture selected every document input. Adding inventory/help forms would serialize unrelated stock data into marketing drafts. Capture and autosave exclusions now cover the new fields. Existing draft/price tests still pass.
3. Unknown screen IDs hid all screens. Navigation now validates the target before changing visibility.
4. Inventory edits carry the loaded version; concurrent updates return 409 rather than silently overwriting stock. The database trigger controls version and timestamps. Cancelled/out-of-order detail loads are ignored and cannot expose an old item's Delete action.
5. Product deletion now explains linked inventory/publishing constraints instead of returning an unexplained saving failure.
6. Recognition results are collected by result index; repeated final events append only once. Cancel ignores late callbacks. Typed text remains unchanged on cancellation or errors. Mocked controller and DOM tests reproduce these cases.

## Database and API

Apply `supabase/migrations/202610180006_inventory.sql` in the Supabase SQL Editor after the existing ordered migrations. This task **did not apply it**. It adds `inventory_items`, product-owner linkage, unique seller/SKU and product references, generated stock status, revision trigger, indexes and owner/business-approved RLS. It does not reset any data.

Stock definitions: zero = out_of_stock; positive quantity <= configured threshold = low_stock; above threshold = in_stock. Quantities and thresholds are whole units from 0 to 1,000,000. Price is optional and never generated; at most two decimals and a supported currency. Each listing can link to only one stock record. Stock and marketing content serve different purposes; stock writes do not mutate listings or prices.

Routes behind existing auth + business gate:
- `GET /api/inventory?search=&category=&status=&sort=updated&page=1` → `{items,total,page,page_size}`.
- `GET /api/inventory-summary` → actual product/inventory/low/out counts.
- `GET /api/inventory/:id` → owner item with linked image URL if available.
- `POST /api/inventory` → 201 persisted item.
- `PUT /api/inventory/:id` → updated item, requires current `version`; 409 on conflict.
- `DELETE /api/inventory/:id?version=N` → 204 or 409; UI requires explicit confirmation.

Writes accept product_id (nullable), name, sku, category (`saree`), quantity, low_stock_threshold, price (nullable), currency, description; update also requires version. Client seller IDs are rejected. Requests use the authenticated seller's existing RLS-scoped Supabase client, never a service key. Cross-seller links are prevented by a composite foreign key.

Local test/demo access is unchanged: it can enter the studio, but **does not unlock inventory, cloud product storage or publishing**. The UI explains this instead of pretending to save. Do not mark test businesses verified to bypass these restrictions.

## Voice capabilities and privacy

Uses feature-detected `SpeechRecognition` / `webkitSpeechRecognition`. Language codes are en-IN, hi-IN, kn-IN, ta-IN, te-IN, ml-IN, mr-IN, bn-IN, selected from existing UI language. Passing a code is not proof that the browser/provider supports it. Unsupported browser/language, denied microphone, missing device, network failure and no-speech states provide typed fallback.

MDN confirms limited browser availability and that some browsers send audio to a remote recognition service:
https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/lang

Kriti requests recognition only after a button click and does not retain audio blobs. Actual device/browser recognition and each language need manual testing. No paid speech provider or fabricated speech API endpoint was added.

## Tests and live status

Automated inventory/Auth/database tests use mocks. Speech and Help tests use mock recognition/DOM; they do not prove audible accuracy or real microphone permission flow. Existing pricing, Gemini, authentication and publishing regression tests remain separate from live provider verification.

`node scripts/test-inventory-live.js` was invoked and reported **NOT RUN**: both test accounts need real business approval and the gate migration before it creates disposable stock records. No inventory fixture or approval was written. Once authorized accounts and schema are ready, the script tests real owner CRUD, generated status/version and cross-seller read/write/delete denial, then cleans up its own fixture.

Manual acceptance after migration: sign in with an approved test seller; add linked/standalone stock, refresh, filter/search/page, edit quantities, test a stale second-tab save, delete with confirmation, and confirm another seller sees no records. Open Help on mobile and keyboard. On a supported browser, initiate microphone input, test deny/allow/stop/cancel, review transcription and explicitly send it through existing photo analysis. No automatic posting or stock deduction should occur.

Final automated result: **118 tests passed, 0 failed**. `npm run typecheck:landing` and `npm run build:landing` passed. Syntax and whitespace checks passed. Browser rendering, live microphone recognition and live inventory RLS were not validated. The CSP permits images only from the configured Supabase origin in addition to existing local/blob/data images, so signed inventory thumbnails are not blocked.
