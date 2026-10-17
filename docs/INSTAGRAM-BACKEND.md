# Instagram backend: implementation and setup

## Diagnosis (17 October 2026)

The original backend had no OAuth/connect/callback adapter, no per-seller token persistence and no publish implementation. `/api/instagram/publish` unconditionally returned 503 after inspecting a client boolean. The existing frontend sends only `{approved:true}` and displays the configuration inventory, not a seller connection. It cannot initiate real authorization or identify an approved saved post. This is an implementation gap, not a demonstrated Meta credential failure.

No frontend files have been changed in this task. Existing analysis, pricing, login and verification rules are preserved. Local demo accounts still cannot connect/publish: every `/api/instagram/*` route remains behind the existing **real business verification** gate. The callback rechecks business approval using its securely bound seller identity.

## Selected flow and documentation limits

Instagram API with Instagram Login, professional Business/Creator accounts; scopes `instagram_business_basic` and `instagram_business_content_publish`. This implementation does not use Facebook Login/Page tokens or legacy Basic Display scopes.

Primary references:
- https://developers.facebook.com/docs/instagram-platform/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
- Meta's official collection: https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00

Meta documentation requests returned HTTP 429 during this audit; the official collection's search-index content was accessible. Exact behavior against the selected Meta API version remains unverified. Do not interpret mocked tests as confirmation of provider endpoint compatibility or granted permissions.

## Required local/deployment configuration

- `INSTAGRAM_APP_ID`: Instagram app ID from the Instagram Login configuration.
- `INSTAGRAM_APP_SECRET`: corresponding Instagram app secret, server only.
- `INSTAGRAM_REDIRECT_URI`: exact HTTPS URL ending `/auth/instagram/callback`; no query or fragment.
- `INSTAGRAM_API_VERSION`: an explicitly enabled/supported Graph version from your Meta app; no guessed default.
- `INSTAGRAM_TOKEN_ENCRYPTION_KEY`: 64 hexadecimal characters (32 random bytes), server only; retain securely across restarts.
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (or existing `SUPABASE_ANON_KEY`).
- `SUPABASE_SERVICE_ROLE_KEY`: server-only elevated key for integration tables and immutable media. Never put this in the browser's account-config or publishable-key field.

Legacy `INSTAGRAM_ACCOUNT_ID` and `INSTAGRAM_ACCESS_TOKEN` are not used. Each seller authorizes their own account. No frontend return URL is needed: callback returns a sanitized JSON result and the seller returns to the same Kriti origin.

None of the Instagram-specific configuration or the server service-role key was present when inspected. Do not paste values into chat or Git. Apply `supabase/migrations/202610170005_instagram.sql` **after the existing migrations** in the correct Supabase project. It creates four server-only tables and a private `instagram-approved` bucket; it does not replace product or verification data.

Use the same public HTTPS origin for the frontend and callback. Start authorization from that origin, not localhost followed by a callback on a different host: the HttpOnly, Secure, SameSite=Lax browser cookie must accompany the callback. Register the exact redirect URI in the Meta app. Ensure your proxy does not log OAuth query strings or provider request URLs containing token exchange secrets.

In the Meta dashboard:
1. Select/create an app with the Instagram API / Instagram Login configuration and enable the login and content-publishing capabilities.
2. Register the exact redirect URI, configure required privacy/data-deletion information and app domains, and obtain the matching Instagram app ID/secret.
3. Use an eligible professional Instagram account. In development mode, assign the required app/tester roles and accept invitations; authorize both requested scopes. A generic personal account is insufficient.
4. For merchants outside development roles, complete the access/app-review and business-verification requirements shown by Meta for these permissions. Credentials alone do not grant production access.
5. Select the supported API version and configure it explicitly. Authorize from Kriti, then inspect `/api/instagram/status`. The backend verifies professional account metadata and granted permissions before recording a connection.

The setup is incomplete until these steps and a real eligible-account authorization succeed. Publishing additionally needs explicit permission from the user for a specific test post; no public post has been authorized or sent by this implementation task.

## API contract for Claude (frontend unchanged)

All `/api/instagram/*` requests require a Supabase bearer session, same-origin access and real business approval. Default errors include `{state,error:{code,message}}`; existing auth/business middleware retains its existing 401/403/503 schema. Configuration absence returns 503 `INSTAGRAM_SETUP_REQUIRED`. Rate limits return HTTP 429.

| Method/path | Input | Success |
|---|---|---|
| GET `/api/instagram/status` | none | `state:not_connected` or `connected`, account `{id,username}`, `expires_at` |
| POST `/api/instagram/connect` | `{}` | `state:connecting`, `authorization_url`; sets browser-bound cookie |
| GET `/auth/instagram/callback` | Meta `code,state` or denial | `state:connected`, sanitized account; one-use state, no bearer header required |
| POST `/api/instagram/disconnect` | `{}` | `state:not_connected`; local encrypted credentials and pending states deleted |
| POST `/api/instagram/approvals` | `{product_id,action:"approve_exact_post",caption}` | 201 `{approval_id,caption,image_sha256,state:"approved",message}` |
| POST `/api/instagram/publish` | `{approval_id}` | job response; 202 while queued/processing/publishing, 200 on confirmed publish |
| GET `/api/instagram/jobs/:id` | none | owner-only job status; does not initiate a publish |

Job response: `{job_id,state,media_id,permalink,error_code,updated_at}`. `permalink` is currently null; no invented link. States: `queued`, `processing`, `publishing`, `published`, `failed`. Connection errors include `reconnect_required`, `permission_required`, `setup_required` and `failed`; not-connected publishing returns 409. Reconnect by calling connect again. Expired/revoked credentials require reauthorization (no automatic refresh job in this version).

### Frontend steps to implement

1. Use GET status for account state; `/api/integrations` is only a configuration inventory.
2. Connect button POSTs connect and navigates to the returned official authorization URL. Handle callback JSON and return to Kriti to refresh status; no Instagram password field.
3. Save the reviewed product to its existing cloud product record, including its private image. Do not use a local-only demo draft or accept a seller ID from the client.
4. Display the exact caption and stored image. An explicit final approval POSTs the product ID, exact complete caption (including any approved price/hashtags), and `action:approve_exact_post`.
5. Retain approval ID; verify the returned image hash against the preview if unsaved local edits are possible. Any text/image edit requires new approval. Show the approved stored version, never silently substitute local edits.
6. A separate **Publish** action POSTs approval ID. `{approved:true}` alone is no longer sufficient. Never publish on generation/save/approval.
7. Poll GET job for authoritative state. A `processing` job can be advanced by an explicit retry of POST publish with the same approval ID. GET never publishes. Do not generate a new approval to retry an uncertain post.
8. `publishing` with `PUBLISH_OUTCOME_UNKNOWN` needs manual reconciliation in Instagram; do not resend or claim failure/success. `queued` after a crash also needs inspection. The backend never automatically repeats an ambiguous publish call.
9. Display setup/reconnect/permission/verification errors and local-only demo limitations honestly.

## Media, persistence and failure handling

Single feed JPEGs only: <=8 MiB, width 320–1440, aspect 0.8–1.91, fully decodable within a 40-million-pixel guard. This deliberately conservative subset excludes video, carousel, Stories and PNG/WebP. Caption limits: 2,200 Unicode code points, 30 hashtags. Confirm current provider limits for your version before deployment.

The approval endpoint reads the seller-owned product/image under existing RLS, validates bytes, stores an immutable private copy, and records its SHA-256 plus exact caption. No arbitrary external media URLs or local paths are accepted. Meta receives a one-hour signed URL for that copy. It must be externally reachable. Approval records are separate from client-controlled product JSON and may only be written by the server after authenticated explicit action.

Tokens use AES-256-GCM with the seller ID as authenticated associated data. Tables have RLS and no anonymous/authenticated grants or policies; the server queries with seller filters. A unique Instagram account ID blocks cross-seller linking. OAuth state and browser binding are stored only as hashes, expire after ten minutes and are atomically consumed. Denied callbacks do not create connections.

A unique approval/job constraint and an atomic processing-to-publishing claim prevent concurrent duplicate publication. Account changes require a new approval/job; the existing job cannot migrate to a different Instagram account. Provider errors are sanitized. Unknown publish results remain unresolved; manual reconciliation is a deliberate safety limit. Disconnect deletes local credentials; to revoke the grant at Meta, remove Kriti in Instagram settings. Approved media/job retention and cleanup should be configured before production; this implementation does not silently delete audit records.

## Verification record

Automated tests use mocked Meta and in-memory database doubles, plus existing HTTP verification-gate tests. They cover state/cookie/expiry/replay/denial, seller binding, encryption/tamper rejection, missing permissions, expired tokens, ownership, exact media, duplicate publishing, container errors and ambiguous timeout behavior. No browser/UI claim is made.

`node scripts/test-instagram-storage-live.js` is a read-only live database grants/schema check, requiring the server key and existing confirmed test account. It verifies missing-table errors are not mistaken for access denial. It does not certify write policies, all storage isolation cases, Meta authorization, email delivery or publishing. The migration has not been applied or validated live by this task.

Real Meta authorization and publication: **NOT RUN**. Credentials, public HTTPS callback, eligible-account access and frontend changes are outstanding. No API success or publicly published post is claimed.
