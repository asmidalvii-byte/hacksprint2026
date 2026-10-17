# Confirmed test account demo access

Set `KRITI_TEST_ACCOUNT_ACCESS=true` locally. Only confirmed Supabase email addresses matching `TEST_SELLER_A_EMAIL` or `TEST_SELLER_B_EMAIL` qualify, after the server validates their session with Supabase. Never send passwords or tokens in chat. No email allowlist is sent to the browser.

The switch is disabled with NODE_ENV=production or a non-loopback HOST. Requests must originate from a loopback socket. Keep this developer server local; do not expose it through a public reverse proxy or tunnel.

GET `/api/seller/demo-access` returns `demo_access`, `business_verified:false`, `storage:"device"` and the notice “Test account — business not verified. Demo drafts are saved on this device only.” It does not write any verification record. If demo access is granted, the workspace opens with a persistent notice. Image analysis, pricing, marketing and voice API requests use their existing configured providers and limits. Provider calls may still fail if credentials are unavailable. No fake AI or verification results replace them.

Cloud product APIs, private storage policies, publishing and real verification remain gated. Demo drafts use local IndexedDB keys scoped to the authenticated test user's ID. That separates drafts within the application; it is not a security boundary against someone with access to the browser profile. JSON export remains available. No migration or Supabase status update is needed to activate the local demo.

Tests cover explicit configuration, production/nonlocal rejection, confirmed email checks, spoofed metadata/header rejection, ordinary-user denial and restricted cloud/publishing routes. Live sign-in/status checks are reported separately from mocked tests.

On 17 October 2026, both locally configured test accounts passed real Supabase password sign-in and the running local `/api/seller/demo-access` endpoint returned demo access. No business records were written. This check did not test browser rendering, live generation, cloud saving or email delivery.
