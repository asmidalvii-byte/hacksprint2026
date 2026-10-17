# Kriti — setup and verification

## Local run

Use Node 22 or newer. From the repository directory:

```sh
npm ci
npm test
npm start
```

Open http://127.0.0.1:3000. Keep `.env` local and ignored. Never commit API keys, passwords, tokens or service-account files.

## Supabase

1. Create a Supabase project. Copy its HTTPS project URL and public publishable key from Connect to `.env`:
   ```dotenv
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLIC-PUBLISHABLE-KEY
   ```
2. Run `supabase/migrations/202610170001_sellers.sql` once in SQL Editor. It creates seller profiles, JSON product snapshots, separate verification records, owner policies and a private product-images bucket. Do not change the bucket to public.
3. Configure Authentication's Site URL and allowed redirect URL as `http://127.0.0.1:3000`. Add the exact deployed HTTPS URL when deploying.
4. Enable email/password signup and email confirmation. Configure an authorized custom SMTP provider for general merchant signup. The built-in email service restricts recipients and email volume. Keep SMTP credentials in Supabase; Kriti does not require them.
5. Restart the backend. Register, confirm email, then sign in. An email rate limit does not require repeatedly registering. A confirmed account can use password sign-in.
6. Save a product, refresh, sign out and sign back in; verify the exact photo, edited text and approved price restore.

Backend requests validate the bearer token using `auth.getUser`. Database calls use the seller's token and public key, so RLS remains active. The service-role key is neither needed nor accepted as the public configuration key. Unauthenticated users cannot call protected APIs when accounts are configured. Without account configuration, a device-only sample demo remains available; partial/invalid configuration fails closed.

Approvals belong to the saved snapshot. Editing the amount revokes price approval; unrelated caption edits do not. A failed price-approval save keeps the amount and requires retry. Final Instagram-post consent is always reset on restore. Product snapshots and private image objects are seller-owned. Identity documents and verification credentials do not belong in snapshots.

## Live isolation test

Create two disposable confirmed accounts through your own project's normal registration process. Add these values ONLY to local `.env`:

```dotenv
TEST_SELLER_A_EMAIL=
TEST_SELLER_A_PASSWORD=
TEST_SELLER_B_EMAIL=
TEST_SELLER_B_PASSWORD=
```

Run `node scripts/test-supabase-live.js`. It uses real Supabase requests, inserts a labelled disposable product and private one-pixel test image, checks owner reads, cross-seller read/update/delete denial and denial of seller-written verification, then deletes its own fixtures. It does not create accounts or send mail. Missing configuration reports NOT RUN, never PASS. Do not run this against personal accounts containing important data.

## Gemini and Sarvam

Keep existing explicit Gemini provider/model settings; the backend must have `AI_ENABLED=true`. For the existing API-key route, `GEMINI_PROVIDER=api-key`, `GEMINI_MODEL` and `GEMINI_API_KEY` are required. No key is returned to the browser. Model configuration is not a live connectivity test.

Sarvam uses server-only `SARVAM_API_KEY` and the configured `SARVAM_MODEL` (see `.env.example`). English, Hindi, Tamil, Telugu, Kannada and Bengali are accepted by the adapter. Tests use mock audio unless explicitly reported live. Device speech remains a separately labelled fallback.

## Verification boundary

No authorized identity, business or GST provider is currently connected. The UI therefore collects no documents or identity numbers and displays setup required. New sellers show Not started, not Verified. The three verification types are independent. Seller roles have SELECT only on authoritative verification records; there is no seller-accessible status-update route.

`server/verification.js` defines an injected authorized adapter boundary. Before enabling it, choose an authorized provider and confirm permitted purposes, consent text, retention/deletion terms, required fields, credentials, sandbox/production access and supported business-name matching. Implement signature-verified, replay-protected callbacks or trusted polling with provider references. Only a narrowly scoped trusted backend/reviewer may persist authoritative outcomes. Never accept a browser-supplied status or provider reference as proof. Validate the real provider's response and expiry rules; test real authorized sandbox/live checks separately from fixtures. No generic provider secret names are invented before provider selection.

GSTIN syntax checking is only input validation, not proof of registration. A successful GST result requires authoritative active registration and supported matching checks. GST registration does not verify an individual's identity. Collect GSTIN only where applicable; this app does not determine legal registration obligations.

## Remaining external checks

- Authenticated browser registration/login/recovery, save/restore and two-account RLS require real confirmed accounts.
- Browser visual checks at desktop/mobile widths remain outstanding because browser automation access was denied; no alternate automation was used.
- No live Sarvam or verification provider test has been claimed. No Instagram publication or ONDC network submission is implemented.
- Market-price dataset is empty. Suggestions are cost/margin arithmetic, not validated market predictions.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Supabase Auth errors](https://supabase.com/docs/guides/auth/debugging/error-codes), [Sarvam TTS](https://docs.sarvam.ai/api-reference/text-to-speech/convert).
