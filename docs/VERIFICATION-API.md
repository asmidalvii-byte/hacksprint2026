# Kriti verification API

Sandbox.co.in **test** lookup is implemented separately at `POST /api/seller/verification/gst/sandbox`. See [GST-SANDBOX.md](GST-SANDBOX.md) for credentials, the live test command and Claude's response contract. Test results do not update authoritative verification or grant access. Production routes below still require provider setup.

All routes require `Authorization: Bearer <Supabase access token>`. The backend resolves the seller with `auth.getUser`; client supplied seller IDs are ignored.

- `GET /api/seller/verification` returns separate business, Udyam, GST, identity and authority statuses plus next action.
- `POST /api/seller/verification/business` validates and stores business details with consent. It returns `not_started`; submission is never verification.
- `POST /api/seller/verification/udyam` validates a Udyam number and returns `setup_required` until an authorized provider adapter is configured.
- `POST /api/seller/verification/gst` validates GSTIN format and returns `setup_required` until an authorized provider adapter is configured.
- `POST /api/seller/verification/review` returns `MANUAL_REVIEW_SETUP_REQUIRED` until a real review workflow exists.
- `POST /api/seller/verification/retry` returns `VERIFICATION_SETUP_REQUIRED` until a supported provider adapter exists.

Statuses are `not_started`, `in_progress`, `pending_review`, `verified`, `action_required`, `rejected`, `failed`, `setup_required`, and `not_applicable`. A legacy `pending` provider result is accepted for compatibility; future adapters should normalize it to `pending_review`.

`UDYAM_PROVIDER_URL` and `GST_PROVIDER_URL` are only provider-presence flags. Setting them does not enable verification. Provider credentials, signed callbacks, response validation and retention rules are still required. No Udyam or GST provider is live, and manual review is not implemented.

Run `supabase/migrations/202610170002_verification_routes.sql` after the base seller migration. It adds business details, Udyam/authority kinds, verification events and seller-read-only RLS policies.
