# Deployment

Status: a `Dockerfile` and this guide exist; no deployment has actually been performed or
verified from this repository. Building and running the container locally is not the same
as a verified cloud deployment — treat every step below as unverified until you've done it
yourself and confirmed the live URL works.

## Secrets: never commit them

`.env` is git-ignored and must stay that way. Every platform below has its own way to inject
environment variables as encrypted secrets at deploy time — that is the only place your real
`GEMINI_API_KEY`, `SARVAM_API_KEY`, or any other credential should ever live outside your own
machine. Never paste a real key into a Dockerfile, a committed file, a build log, or chat.

Required/optional environment variables are documented in [.env.example](../.env.example).
At minimum for a working deployment:

```
HOST=0.0.0.0
PORT=3000                      # most platforms override this automatically; leave it as-is
AI_ENABLED=true
GEMINI_PROVIDER=api-key        # or vertex, if using Application Default Credentials
GEMINI_API_KEY=                # set as a platform secret, not here
GEMINI_MODEL=                  # set to a model you've verified against your account
SARVAM_API_KEY=                # optional; leave blank to keep device-voice-only playback
```

`HOST=0.0.0.0` is required in a container — the app defaults to `127.0.0.1` for local safety,
which would make it unreachable from outside the container.

## Build and run the container locally first

Always verify the image actually starts before deploying it anywhere:

```sh
docker build -t dukaanscan .
docker run -p 3000:3000 \
  -e AI_ENABLED=true \
  -e GEMINI_PROVIDER=api-key \
  -e GEMINI_API_KEY=your-key-here \
  -e GEMINI_MODEL=your-verified-model \
  -e SARVAM_API_KEY=your-sarvam-key-here \
  dukaanscan
```

Open `http://localhost:3000` and confirm the app loads and `/api/status` / `/api/integrations`
report the configuration you expect before deploying further.

## Option A: Google Cloud Run

Cloud Run is a reasonable fit for this single Node process. This repo does not include Cloud
Build config; the steps below use the CLI directly. Prerequisites and Vertex-specific setup
(if you use `GEMINI_PROVIDER=vertex` instead of `api-key`) are in
[GOOGLE-CLOUD-SETUP.md](GOOGLE-CLOUD-SETUP.md) — read that first if you want Vertex rather
than the Gemini Developer API key route.

```sh
gcloud run deploy dukaanscan \
  --source . \
  --region YOUR_REGION \
  --allow-unauthenticated \
  --set-env-vars HOST=0.0.0.0,AI_ENABLED=true,GEMINI_PROVIDER=api-key,GEMINI_MODEL=your-verified-model \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest,SARVAM_API_KEY=sarvam-api-key:latest
```

`--set-secrets` pulls from Secret Manager — create those secrets first
(`gcloud secrets create gemini-api-key --data-file=-`, entering the key interactively, never
as a command-line argument that lands in shell history). `--allow-unauthenticated` makes the
demo publicly reachable; the app has no login of its own (see the "Data and safeguards"
section of the main [README](../README.md)) — only do this for a demo you're comfortable
being public, and consider Cloud Run's IAM-based access control instead if not.

## Option B: Render / Railway / Fly.io (Dockerfile-based platforms)

These platforms generally: connect to this GitHub repo, detect the `Dockerfile` automatically,
and offer a dashboard or CLI to set environment variables as secrets before the first deploy.
The exact steps differ per platform; in all cases:

1. Connect the GitHub repo (this one, `hacksprint2026`).
2. Let the platform build from the `Dockerfile` (no code changes needed — it's standard).
3. Set the environment variables listed above in the platform's secrets/environment UI, not
   in any file that gets committed.
4. Deploy, then verify `/api/status` and `/api/integrations` on the live URL before trusting it.

## After deploying

- The in-memory rate limiter and 2-concurrent-request cap (see [server/app.js](../server/app.js))
  are sized for a single demo instance, not production multi-instance traffic.
- No authentication or multi-merchant isolation exists — anyone with the URL can use the app
  and see its outputs. Don't deploy publicly with real customer data.
- Confirm the deployed `GEMINI_MODEL` is actually available to your account/project in that
  region before relying on it — a configured model name is not proof of access.
