# Business ID registration and login

The login page offers separate Sign in / Create account actions, labelled GSTIN/Udyam fields, consent, inline errors and a clearly labelled sample verification preview. It retains Kriti's warm palette and uses responsive form spacing, focus indicators and accessible status messages. The layout follows the UI/UX Pro Max accessibility and form guidance.

Registration now supplies `options.data.business_id_type`, `business_id`, and `business_id_consent` to the existing Supabase signUp client. A correctly formatted GSTIN OR Udyam ID is required. This is syntax checking only: neither registration existence nor ownership is established, and no authoritative verification record is written. User metadata is seller-provided and must never authorize protected access.

Apply `supabase/migrations/202610170004_registration_identifier.sql` in the Supabase SQL editor. It installs a BEFORE INSERT trigger on auth.users so direct signup calls cannot omit the ID or consent. Existing users are unaffected. This applies to new admin-created/invited/OAuth users too: they need compliant metadata. The migration has NOT been applied or live-tested by the agent. Until applied, only browser registration validation is active. Invalid requests may receive Supabase's generic database signup error; inspect Auth logs without exposing identifiers or credentials.

After application, test with disposable accounts: missing ID, malformed ID, false consent and unknown type must create no Auth user; correct GSTIN and Udyam formats must permit signup subject to normal email/password rules. None should acquire business approval. This trigger is not a verification-provider replacement. Supabase documents auth.users triggers and signup metadata at https://supabase.com/docs/guides/auth/managing-user-data.

The frontend now checks `GET /api/seller/verification` after sign-in and keeps the workspace hidden unless `access_allowed` is true. Sessions remain valid so the seller can refresh verification status or sign out. Apply business access migration 003 as well for database/storage enforcement.

Automated UI tests use mocked Auth. They cover missing/malformed IDs, consent, normalization, metadata, form switching, login/reset and duplicate submissions. Rendered browser and live database trigger checks are separate and must not be inferred from those tests.
