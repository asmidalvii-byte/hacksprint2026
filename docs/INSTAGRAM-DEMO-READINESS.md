# Instagram workflow and demo readiness

Updated 2026-10-17. Starting commit: 7080ff9. Existing analysis, textile, pricing, marketing generation and IndexedDB storage were reused. No new dependency or paid Gemini call was needed.

## Implemented changes

- A clearly labelled Instagram post studio beside the existing listing, with the existing five-language marketing selector.
- Current caption and hashtags drive the visible post preview, copying and WhatsApp draft text. Optional price comes only from the seller-approved price. Hashtags are formatted consistently in copied/shared text.
- Character and hashtag counts update on edits. These are guidance, not a promise that all current Instagram requirements are satisfied. Missing # prefixes are flagged without silently rewriting seller text.
- Generation has explicit progress/result messages. Existing confirmation before replacing modified/stale drafts, failure preservation and local persistence remain.
- A separate final approval covers the actual image, caption, hashtags and included price. It is invalidated by edits or restore. Post to Instagram refuses without an image and approval.
- The connection/setup panel lists missing configuration and account/adapter prerequisites. Refresh checks backend configuration only; it never treats configured variables as verified permission.
- Creative download requests the actual uploaded image. Draft export errors leave edits intact and report failure. Download messages describe a request, not confirmed OS completion.

## Publishing is NOT connected

Actual inspected missing settings: INSTAGRAM_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_API_VERSION. Meta app credentials/account permissions are not configured or verified. The existing backend intentionally returns HTTP 503 / INSTAGRAM_SETUP_REQUIRED; it does not call Meta or simulate a post.

The setup-required fallback is implemented. An official publishing adapter, hosted media, token/account verification, API-confirmed publication and durable duplicate prevention remain unimplemented. Environment variables alone will not enable publishing. Use an authorized Business or Creator account and the official Meta login route; backend-only tokens and proper content-publishing permissions are required. Exact prerequisites and official source links are in [FINAL-MILESTONES.md](FINAL-MILESTONES.md). No Instagram password is collected.

## Browser verification: blocked

This turn inspected the original in-app browser. The previous local tab had become a data-URL connection-error page; selecting the local HTTP URL returned "Tab not found." Opening the running local app through the in-app browser was then denied by automatic approval review because it was considered circumvention of the earlier blocked local-browser path. No alternate browser, raw CDP, Playwright execution or browser-command workaround was used after that denial.

Therefore no rendered UI, screenshot, actual clipboard, actual file download, actual WhatsApp navigation or browser-console verification is claimed. Existing Playwright tests remain available but unexecuted. Browser access must be explicitly resolved before those checks can be completed. The server being reachable is not browser verification.

## Actual tests

`npm test`: **49 passed, 0 failed**. Includes prior regressions plus Instagram preview/count, exact-image approval and missing-configuration status tests. DOM-handler tests simulate browser elements; clipboard/download/window calls are test doubles. Persistence uses fake-indexeddb. HTTP fallback tests use a real local server, not the Meta API. Mock Gemini tests remain mocked. No live external API calls were added in this turn.

Previous live Gemini tests succeeded through the API-key route; they were not rerun unnecessarily. No Instagram publication, Cloud Storage upload, BigQuery write or Vertex operation has been verified live.

Syntax and whitespace checks passed. Pre-push checks scan for locally configured secrets and key patterns without printing secret values. No credentials enter bundles or exports.

## Cloud status

Gemini provider remains api-key. Vertex AI is not selected; existing adapter requires authorized project/location/model and ADC before live verification. Cloud Storage and BigQuery adapters remain absent, with no project/bucket/dataset/table/ADC configuration. These were not rushed into the app without credentials. Local editing and exports remain independent of them. Setup requirements remain in FINAL-MILESTONES.md.

## Start and manual acceptance

Run `npm ci` and `npm start` from the existing repository with the local .env configured. URL: http://127.0.0.1:3000/ . Do not overwrite the existing .env. Use a single browser tab for the single saved draft.

Once browser access is permitted:

1. Open the app; confirm no visible error. Upload a real product photo; use existing Gemini analysis or labelled sample fallback.
2. Review the listing and evidence. Calculate cost 800 / (1 - 20/100) = 1000 using clearly labelled demonstration inputs. Confirm any existing seller price remains unchanged.
3. Open Instagram post studio. Choose a supported language and generate the draft from reviewed listing facts.
4. Edit caption/hashtags. Verify preview/count update and the correct local photo appears. Enable approved-price inclusion only after price approval.
5. Edit the draft, request regeneration, cancel and verify edits remain. Simulate an API failure and verify the previous draft is preserved.
6. Save and wait for success; refresh. Verify photo, price and text restore, but sharing/publishing approvals are unchecked.
7. Reapprove the relevant fields. Copy caption/hashtags; inspect the clipboard. Download the image and compare it with the uploaded file. Export and parse JSON.
8. Open WhatsApp sharing and verify its text is the current Instagram draft. Do not send automatically or claim it was sent.
9. Approve the exact final image/text/price and click Post to Instagram. Verify setup required, not success. Refresh connection status and inspect missing settings.
10. Export the catalog. Check separate seller price, pricing recommendation, evidence and marketing text. Check narrow-screen controls, layout, accessibility labels and console errors.

## Changed files

index.html, intelligence-ui.js, draft-persistence.js, tests/pricing-ui.test.js, tests/browser/final-milestones.spec.js, README.md and this report. No completed product-analysis module was rewritten. Changes are committed/pushed under the user's standing authorization; see Git history for the current commit.
