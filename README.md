# Dukaan-Scan AI

An interactive hackathon demo for local merchants: upload a product photo, edit a catalog draft, set an optional selling price, create regional ad scripts, and export catalog JSON.

[Live demo](https://dukaan-scan-studio.asmidalvii.chatgpt.site) (owner sign-in may be required)

## Run locally

No package installation or build is required. From this folder:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Click **No photo? Try a sample saree** to explore without uploading an image.

## Features

- Local photo upload and preview (JPG, PNG, WebP; maximum 10 MB).
- Editable category-based product listing drafts.
- Merchant-controlled pricing; no prices inferred from images.
- Editable Hindi, Tamil, Telugu, Kannada and Bengali ad templates.
- Voice preview using matching voices installed on the device.
- Merchant review required before playback or catalog export.
- JSON catalog draft download.
- Compact desktop layout with responsive mobile layout.

## Demo boundaries

Gemini Vision, Sarvam and BigQuery are not connected. Draft copy uses sample templates, not image recognition. Material, condition and other product facts must be confirmed by the merchant. Regional ad templates retain the product title as written. Browser audio requires an installed voice for the selected language.

Uploaded photos stay in the browser and are not included in exported JSON. Exported data is an integration draft, not an ONDC-compliant submission. Seller onboarding, category mapping, hosted images, fulfilment, tax, availability and protocol validation remain necessary.

## Files

- `index.html`: merchant workspace
- `style.css`: responsive layout and styling
- `app.js`: upload, draft editing, language templates, voice preview and export

Track concept: PS 21 (small merchants), PS 42 (Gemini + GCP), PS 41 (Sarvam).
