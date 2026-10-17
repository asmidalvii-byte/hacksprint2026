# Sandbox.co.in GST test API

This backend adapter calls the external test API; it is not local sample data. It is not production business verification. It never writes verification records or grants dashboard access. Provider access and credentials must be configured before a real test call can succeed. No frontend changes are included.

## Local setup

Use your Sandbox.co.in account with access to GST Search GSTIN in its test environment. Set these in the ignored local `.env` (never chat or GitHub):

```
GST_SANDBOX_ENABLED=true
GST_SANDBOX_API_KEY=
GST_SANDBOX_API_SECRET=
GST_SANDBOX_TEST_GSTIN=
```

Use the provider's test GSTIN for your test scenario. No placeholder GSTIN is claimed to be supported. Restart with `npm start`, then run `node scripts/test-gst-sandbox.js`. The script performs a real authentication and lookup request only when all configuration is present, and prints no credentials or registration details.

## Claude API contract

POST `/api/seller/verification/gst/sandbox`, with the existing Supabase bearer session and JSON `{ "gstin": "<provider test GSTIN>", "consent": true, "legal_name": "<optional expected name>" }`. An unverified authenticated account may use this route. Limit: three requests per minute per IP. No auth token belongs in frontend source files.

On 200, show `notice` prominently. Response has `demo:true`, `environment:"test"`, `provider:"sandbox.co.in"`, `authoritative:false`; `data` contains `status:"sandbox_result"`, `access_allowed:false`, `registration_status`, `legal_name`, `masked_gstin`, `active`, `name_match` (true/false/null), `name_match_method`, `provider_reference`, `checked_at`, `next_action:"review_sandbox_result"`. Render names as text. A name match is normalized exact text comparison only; it does not prove authority to represent the business.

400: input/consent error. 401: sign-in required. 429: local/provider rate limit. 503: setup required, credentials/access rejected, timeout, incomplete/mismatched response or provider failure. Errors have `error.code` and a sanitized `error.message`; no provider response bodies or secrets are returned. Failures do not change seller status.

The real `/api/seller/verification/gst` route and business access gate remain separate. A successful sandbox lookup does not unlock them. The public `/api/demo/verification` endpoint is explicitly static sample data, not a Sandbox API call.

## Provider contract consulted

- [Authentication](https://developer.sandbox.co.in/api-reference/authenticate): POST `/authenticate` with x-api-key and x-api-secret; returned access_token goes into authorization without a Bearer prefix.
- [GSTIN search](https://developer.sandbox.co.in/api-reference/gst/compliance/endpoints/public/search_gstin): POST `/gst/compliance/public/gstin/search`, JSON gstin; successful registration payload is data.data with data.status_cd equal to "1".
- [Test environment](https://sandbox-docs.readme.io/reference/gst-test-cases): test host https://test-api.sandbox.co.in. The adapter fixes this host and rejects redirects; environment variables cannot switch it to production.

Automated adapter/HTTP tests use explicitly synthetic responses. Only a passing `test-gst-sandbox.js` run establishes a real external sandbox lookup; it does not establish real registration verification or rendered UI behavior.
