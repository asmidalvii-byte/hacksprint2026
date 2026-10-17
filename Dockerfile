# Node 22+ required (see package.json engines). Debian-based (not alpine) so sharp's
# prebuilt native binary installs cleanly without extra build tooling.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV HOST=0.0.0.0
# Most platforms (Cloud Run, Render, Fly.io) inject PORT at runtime; 3000 is the local default.
ENV PORT=3000
EXPOSE 3000

# AI_ENABLED, GEMINI_*, SARVAM_* etc. are NOT set here — inject them as secrets/env vars
# on your hosting platform at deploy time. Never bake credentials into the image.
CMD ["node", "server/index.js"]
