# Google Cloud setup and verification

Status: no Google project, billing, API enablement, ADC, model access, Cloud Storage or BigQuery has been verified for this project. A local config file or a passing mocked test is not proof of integration.

## Current choice: Gemini API key on this Mac

The user selected the Gemini API-key route. Local `.env` now has `GEMINI_PROVIDER=api-key`; `AI_ENABLED` remains false until credentials and model are ready. The key and model were still empty at the latest check. This route needs no ADC, `GOOGLE_CLOUD_PROJECT` or `GOOGLE_CLOUD_LOCATION` in the app. A Google project still underlies the key for access/quota/billing.

1. Open https://ai.google.dev/gemini-api/docs/api-key and follow its Google AI Studio link. Sign in personally and create a key in a project you are authorized to use. If key creation is blocked, the account/project administrator must supply the permissions listed in that official guide. Never send the key in chat.
2. In the already-open local `.env`, enter the key after `GEMINI_API_KEY=` and save. Leave `GEMINI_MODEL` blank until models have been queried. The file is ignored by Git and owner-readable/writable only.
3. From Terminal on this Mac:

```sh
cd /Users/apple/Documents/Codex/2026-10-16/we-are-building-dukaanscan-for-hacksprint/work/hacksprint2026
npm run models
```

This queries Google's model list using the key in a request header, without printing it. It prints only model IDs supporting `generateContent`. Listing a model is not proof of image/schema compatibility or sufficient generation quota. The agent will check the candidate's documentation and test it with the actual image before claiming success.

4. Set `GEMINI_MODEL` to the verified candidate ID and `AI_ENABLED=true` in `.env`. Do not enter a guessed location; it is unused for this route. Restart the Node server (stop the existing one with Ctrl+C before starting another):

```sh
npm start
```

5. Have Sakshi provide a clear actual product photo to Asmi. Upload it here or supply its absolute local path. Then, in a second Terminal in the same repository:

```sh
npm run test:live -- /absolute/path/to/the-actual-product.jpg
```

The path above must be replaced with the real file path. After the live endpoint succeeds, complete the browser review/apply/edit/price/approve/export flow and inspect the JSON. Do not treat a successful model-list request or mocked test as completed Milestone 1.

Google CLI archive was downloaded to `work/google-cloud-cli/` while preparing the Vertex option and matched the SHA256 published on Google's installation page. It was not installed or authenticated; it is unnecessary for the selected API-key route.

## Milestone 1: Gemini

Recommended route: Gemini through Vertex AI using Application Default Credentials. The installed `@google/genai` SDK supports both Vertex AI and the Gemini Developer API. Model identifiers change; select an image-capable model available to your project with structured JSON output, and set the exact identifier in `GEMINI_MODEL`. This repository deliberately has no assumed model default.

Asmi/account owner must:

1. Create or select a Google Cloud project and link an authorized billing account in the Cloud console. Share the project ID (not a credential), preferred location and available model identifier.
2. Have a project administrator enable `aiplatform.googleapis.com`. API enablement requires `serviceusage.services.enable` (for example Service Usage Admin); this is a setup permission, not a runtime permission.
3. Grant the development identity Vertex AI User (`roles/aiplatform.user`) and Service Usage Consumer (`roles/serviceusage.serviceUsageConsumer`) if needed for the ADC quota project. Organizational restrictions may require administrator action.
4. Install Google Cloud CLI from the official instructions, then personally complete browser authentication. Do not share access tokens or downloaded credential files.

```sh
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

Create `.env` locally from `.env.example` and set:

```dotenv
AI_ENABLED=true
GEMINI_PROVIDER=vertex
GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
GOOGLE_CLOUD_LOCATION=YOUR_VERIFIED_MODEL_LOCATION
GEMINI_MODEL=YOUR_VERIFIED_IMAGE_CAPABLE_MODEL
```

The application uses ADC; do not copy credential JSON into this repository. Set no browser credentials. Restart `npm start` after changing configuration.

Verify API enablement (read-only):

```sh
gcloud services list --enabled --project=YOUR_PROJECT_ID
```

Then run the backend and a real test:

```sh
npm start
# In a second terminal:
npm run test:live -- /absolute/path/to/real-product.jpg
```

Finally use the browser to compare the output against three real product photos. A schema-valid response is not proof that every visual claim is correct. Record model/location, date, factual errors, ambiguity and whether evidence actually supports the proposed fields. Never log API keys, raw uploaded images or personal merchant notes.

### Alternative first-test route

If Google Cloud access is delayed, an authorized Google AI Studio API key can be entered directly in the local `.env` file:

```dotenv
AI_ENABLED=true
GEMINI_PROVIDER=api-key
GEMINI_API_KEY=ENTER_LOCALLY_ONLY
GEMINI_MODEL=YOUR_VERIFIED_IMAGE_CAPABLE_MODEL
```

This verifies Gemini Developer API only; it does not verify Vertex AI, Storage or BigQuery. The runtime explicitly selects the configured provider.

## Milestone 2: regional AI content

After the real image flow passes: add an ad-generation endpoint accepting only merchant-reviewed facts, selected language and explicit price-inclusion choice. Return draft text with supported-fact references, disallow added product claims and require review again. Existing regional templates and device voice remain the fallback. This endpoint is not implemented yet because live Milestone 1 is still pending.

## Milestone 3: Storage and BigQuery

Do not enable these before Gemini access and the core flow are verified. Resource names, region, billing and account authorization are still needed.

Storage plan:
- Enable `storage.googleapis.com`; create a private bucket with uniform bucket-level access and public access prevention.
- Use UUID object names and store only after explicit merchant action. Define retention/deletion behavior before upload.
- Scope `roles/storage.objectCreator` to that bucket for writes; add read permission only if the backend needs it. No public bucket and no long-lived object URLs in exports.
- Acceptance test: upload a non-sensitive test image, verify bytes/content type, confirm anonymous access fails, then remove the test object using an authorized identity. Resource creation/deletion permissions belong to setup/test identities as needed.

BigQuery plan:
- Enable `bigquery.googleapis.com`; create a dataset and a table in the selected compatible location.
- Record useful events: request ID, timestamp, outcome/error code, latency, model, evidence count, accepted-field count, and sample fallback usage. Do not store raw images, notes, ad scripts or credentials.
- Use dataset-scoped BigQuery Data Editor for ingestion; grant BigQuery Job User to the identity performing verification queries. Narrow permissions further when the exact write method is selected.
- Acceptance test: write a known test event and query it back; confirm optional analytics failures do not prevent catalog editing/export.

No Storage or BigQuery SDK has been added yet. Their integration must follow account verification and Milestone 1, as requested.

## Deployment

Cloud Run is appropriate for this Node backend and frontend together. Deployment is not configured or tested yet. Use a dedicated attached runtime service account with Vertex AI permission, `HOST=0.0.0.0`, platform `PORT`, a bounded instance count and authenticated access for testing. Select regional deployment and model endpoint deliberately. A public demo needs access controls and shared rate limiting; the current in-memory limiter is intended for the local/single-process demo. Keep credentials in the service identity or Secret Manager, never image layers or source.

Deploying from source additionally needs Cloud Run, Cloud Build and Artifact Registry services and the appropriate deployer/build permissions. Verify deployment identity and service identity separately before creating resources.

## Official references

- SDK: https://github.com/googleapis/js-genai
- Vertex AI quickstart: https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart
- ADC setup: https://cloud.google.com/docs/authentication/provide-credentials-adc
- CLI installation: https://cloud.google.com/sdk/docs/install
- Structured output: https://ai.google.dev/gemini-api/docs/structured-output
- Storage permissions: https://cloud.google.com/storage/docs/access-control/iam-roles
- BigQuery permissions: https://cloud.google.com/bigquery/docs/access-control
- Cloud Run identity: https://cloud.google.com/run/docs/securing/service-identity

## Latest local configuration — 17 October 2026

API-key authentication and a live text-only structured generation check passed using `gemini-3.8-flash`. Local configuration is now `GEMINI_PROVIDER=api-key`, `GEMINI_MODEL=gemini-3.8-flash`, `AI_ENABLED=true`. The API key is stored only in the ignored local `.env`. No Cloud location or ADC is used. Earlier empty-key status describes the prior setup state. A real product-photo test is still required before Milestone 1 can be marked complete.

Model documentation: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash

## Verified real-photo configuration — 17 October 2026

Latest local settings: `GEMINI_PROVIDER=api-key`, `GEMINI_MODEL=gemini-3.5-flash-lite`, `AI_ENABLED=true`. A real product photo completed two live browser/editor/export tests. This supersedes the earlier 3.8 text-only checkpoint. 3.8 returned high-demand errors during image testing. Native Gemini responseSchema mapping resolved a separate invalid-argument error. Cloud location and ADC are unused on this route. See IMPLEMENTATION-REPORT.md for tests and remaining seller confirmations.
