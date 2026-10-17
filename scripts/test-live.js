import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileTypeFromBuffer } from 'file-type';
import { getConfig } from '../server/config.js';
import { validateAnalysis } from '../server/validate-analysis.js';
const config = getConfig();
const path = process.argv[2];
if (!config.configured || !path) {
  console.error('LIVE TEST NOT RUN: configure .env and provide a real product image: npm run test:live -- /absolute/path/product.jpg');
  if (config.missing.length) console.error('Missing configuration names: ' + config.missing.join(', '));
  process.exitCode = 1;
} else {
  try {
    const bytes = await readFile(path); const type = await fileTypeFromBuffer(bytes);
    if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime)) throw new Error('Unsupported image');
    const form = new FormData(); form.append('image', new Blob([bytes], { type: type.mime }), 'product');
    const response = await fetch(`http://127.0.0.1:${config.port}/api/analyze-product`, { method: 'POST', body: form, signal: AbortSignal.timeout(config.timeoutMs + 10000) });
    const result = await response.json();
    if (!response.ok) { console.error('LIVE TEST FAILED: ' + (result.error?.code || response.status)); process.exitCode = 1; }
    else {
      const { schemaVersion, source, requestId, merchantReview, provenance, ...claims } = result;
      validateAnalysis(claims);
      if (source !== 'gemini' || merchantReview.status !== 'pending') throw new Error('Invalid response envelope');
      console.log('LIVE REQUEST PASSED: server returned schema-valid Gemini output.');
      console.log('Factual accuracy still requires comparing the suggestions with this image in the UI.');
      console.log(JSON.stringify({ provider: provenance.provider, model: provenance.model, analyzedAt: provenance.analyzedAt, evidenceCount: claims.evidence.length }));
    }
  } catch { console.error('LIVE TEST FAILED: check the running backend, local image, credentials, model and location. No credentials or raw upstream errors were printed.'); process.exitCode = 1; }
}
