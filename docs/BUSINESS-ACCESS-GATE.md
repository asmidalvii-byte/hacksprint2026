# Business access gate — backend contract for Claude

Apply `supabase/migrations/202610170003_business_access_gate.sql` after migrations 001 and 002, then restart the backend. This migration has not been applied by the implementation agent. Do not treat deployment as complete until live RLS tests pass.

## Authorization rule
Supabase authentication preserves the session. Every protected API request separately reads the authenticated seller's authoritative verification records. Access requires BOTH a `business` record and either `udyam` OR `gst`, each `verified`, with a nonempty trusted provider/reviewer reference, a valid verification timestamp no later than now, and no expiry or an expiry in the future. Identity and authority records remain separate and are not substitutes. A trusted overall business decision must establish that the registration belongs to this seller's submitted business; number syntax alone is insufficient. No client, registration form, or public API can write these approvals. No automated trusted writer/provider is configured yet.

Changes to business details invalidate business/Udyam/GST approvals through a database trigger, including direct Supabase writes. Consent is now persisted. Product and private product-image access additionally requires this same rule in restrictive RLS policies AND the existing owner policies. Existing signed image URLs can remain usable until their original expiry; this migration does not revoke already issued URLs or downloaded files.

## Responses and frontend behavior
- `GET /api/demo/verification` is a public, read-only demonstration response. It is marked `demo: true`, `authoritative: false`, uses `method: sample`, and always returns `access_allowed: false`. It must never be used as a login decision or written to Supabase. This is the route to use for a HackSprint walkthrough when no provider is available.
- Invalid/missing session: 401. Use login.
- Authenticated but unverified: 403 JSON `{ "allowed": false, "code": "BUSINESS_VERIFICATION_REQUIRED", "business_status": "pending_review", "next_action": "wait_for_review", "message": "Business verification status: pending_review." }` (actual status varies).
- Database lookup failure: 503 `BUSINESS_VERIFICATION_UNAVAILABLE`, null status, `retry_status`.
- Accounts not configured: 503 `ACCOUNT_SETUP_REQUIRED`, null status, `configure_accounts`. No unauthenticated AI fallback API; local sample assets remain static.
- Missing/malformed records: denied; `not_started`/`start_verification`. A nominally verified but unsupported/expired approval: denied with `action_required`/`correct_information`.
- in_progress → continue_verification; pending_review → wait_for_review; rejected/not_applicable → contact_support; failed → retry_verification; setup_required → provider_setup; expired → renew_verification. Retry is a UI hint, not a promise that a provider is configured.

Public: GET account-config, status, integrations and static app files. Static HTML contains no private seller data. Supabase login/logout remain independent. Authenticated verification GET/POST routes remain reachable without business approval. GET `/api/seller/verification` adds `data.access_allowed` and `data.next_action`; raw `business_status` remains distinct from access eligibility. Never infer access merely from a registration status. Udyam/GST submission currently responds 503 setup_required; manual review is unavailable. Do not display verification success or send users into a login loop.

Claude: after sign-in query verification status, render onboarding if `access_allowed` is false, and handle 403 from any protected request by showing the verification screen without signing out. Do not present the dashboard as available before authorization. Frontend files were intentionally not modified. Local/offline demo features require this frontend integration to hide them; backend gates protect server features and database data.

## Testing
`npm test`: mock HTTP/auth/DB and local unit tests, not provider verification or live RLS.
`node scripts/test-business-gate-live.js`: requires migration 003 and an unverified disposable TEST_SELLER_A account; checks actual database denial.
`node scripts/test-supabase-live.js`: positive isolation checks now require two genuinely verified disposable sellers and migration 003. Do not manufacture approvals to make this test pass.
Neither script tests email delivery or browser navigation. An authorized Udyam/GST provider contract and credentials are still required for live registration checks. No claim of a working provider integration is made.
