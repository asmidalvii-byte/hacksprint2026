import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createApp } from '../server/app.js';
import { getConfig } from '../server/config.js';
import { validateAnalysis } from '../server/validate-analysis.js';
import { createAnalyzer } from '../server/gemini.js';
import { fixture } from './fixture.js';
const config = { ...getConfig({ AI_ENABLED: 'true', GEMINI_PROVIDER: 'api-key', GEMINI_API_KEY: 'test-placeholder', GEMINI_MODEL: 'test-model' }), timeoutMs: 1000 };
const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#0000ff' } }).png().toBuffer();
async function serve(t, overrides = {}) {
  const server = createApp({ config, analyze: async () => fixture(), ...overrides }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, post: (form = imageForm(), headers) => fetch(url + '/api/analyze-product', { method: 'POST', body: form, headers }) };
}
function imageForm(bytes = png, type = 'image/png', fields = {}) {
  const form = new FormData(); form.append('image', new Blob([bytes], { type }), 'product.png');
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}
test('schema rejects invented fields, prices and unsupported evidence', () => {
  for (const mutate of [v => v.price = 100, v => v.title.evidenceIds = ['missing'], v => v.evidence.push(v.evidence[0]), v => v.title.evidenceIds = [], v => v.category.value = 'invented', v => v.evidence[0].inputId = 'notes-1']) {
    const value = fixture(); mutate(value); assert.throws(() => validateAnalysis(value));
  }
  assert.equal(validateAnalysis(fixture()).category.value, 'saree');
});
test('merchant note evidence requires submitted notes', () => {
  const value = fixture(); value.evidence[0].kind = 'merchant_text'; value.evidence[0].inputId = 'notes-1';
  assert.throws(() => validateAnalysis(value)); assert.doesNotThrow(() => validateAnalysis(value, { hasNotes: true }));
});
test('SDK adapter sends image bytes and structured response request', async () => {
  let request;
  const analyze = createAnalyzer(config, { models: { generateContent: async args => { request = args; return { text: JSON.stringify(fixture()), candidates: [{ finishReason: 'STOP' }] }; } } });
  await analyze({ bytes: png, mimeType: 'image/png', notes: 'Seller note', category: 'saree', signal: new AbortController().signal });
  assert.equal(request.contents[0].parts[1].inlineData.data, png.toString('base64'));
  assert.equal(request.config.responseMimeType, 'application/json');
  assert.equal(request.config.responseSchema.properties.category.properties.value.nullable, true); assert.deepEqual(request.config.responseSchema.properties.category.properties.value.enum, ['saree', 'pot', 'jewelry', 'other']); assert.ok(request.config.abortSignal);
});
test('SDK rejects blocked, truncated and malformed responses', async () => {
  for (const response of [{ text: 'no json' }, { text: JSON.stringify(fixture()), candidates: [{ finishReason: 'MAX_TOKENS' }] }, { promptFeedback: { blockReason: 'SAFETY' } }]) {
    const analyze = createAnalyzer(config, { models: { generateContent: async () => response } });
    await assert.rejects(analyze({ bytes: png, mimeType: 'image/png', notes: '', category: 'saree' }));
  }
});
test('successful endpoint decodes image, calls analyzer and marks review pending', async t => {
  let received;
  const { post } = await serve(t, { analyze: async input => { received = input; return fixture(); } });
  const response = await post(); assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.source, 'gemini'); assert.equal(body.merchantReview.status, 'pending');
  assert.equal(body.provenance.imageStored, false); assert.equal(received.mimeType, 'image/jpeg');
  assert.equal((await sharp(received.bytes).metadata()).format, 'jpeg');
});
test('disabled service never calls AI', async t => {
  const { post } = await serve(t, { config: getConfig({}), analyze: () => { throw new Error('Must not run'); } });
  assert.equal((await post()).status, 503);
});
test('rejects corrupt, spoofed, missing and oversize images', async t => {
  const { post } = await serve(t, { config: { ...config, maxUploadBytes: 300 } });
  for (const form of [new FormData(), imageForm(Buffer.from('bad')), imageForm(png, 'image/jpeg'), imageForm(Buffer.alloc(400))]) {
    const response = await post(form); assert.ok([400, 413].includes(response.status));
  }
});
test('rejects unknown, repeated, overlong request fields and invalid categories', async t => {
  const { post } = await serve(t);
  for (const fields of [{ category: 'wrong' }, { notes: 'x'.repeat(4001) }, { price: '100' }]) assert.equal((await post(imageForm(png, 'image/png', fields))).status, 400);
  const form = imageForm(png, 'image/png', { notes: 'a' }); form.append('notes', 'b');
  assert.equal((await post(form)).status, 400);
});
test('timeouts return a safe actionable error and abort upstream', async t => {
  let signal;
  const { post } = await serve(t, { config: { ...config, timeoutMs: 30 }, analyze: args => { signal = args.signal; return new Promise(() => {}); } });
  const response = await post(); assert.equal(response.status, 504); assert.equal(signal.aborted, true);
  assert.equal((await response.json()).error.code, 'AI_TIMEOUT');
});
test('SDK errors never disclose upstream secrets', async t => {
  const { post } = await serve(t, { analyze: async () => { throw Object.assign(new Error('secret-value'), { status: 403 }); } });
  const response = await post(); assert.equal(response.status, 503); const text = await response.text(); assert.ok(!text.includes('secret-value')); assert.match(text, /AI_ACCESS/);
});
test('invalid AI output is rejected at API boundary', async t => {
  const { post } = await serve(t, { analyze: async () => ({ ...fixture(), price: '100' }) });
  assert.equal((await post()).status, 502);
});
test('server exposes only frontend assets and rejects cross-origin requests', async t => {
  const { url, post } = await serve(t);
  for (const path of ['/.env', '/server/config.js', '/package.json', '/.git/config', '/shared/analysis-contract.js']) assert.equal((await fetch(url + path)).status, 404);
  assert.equal((await fetch(url)).status, 200);
  assert.equal((await post(imageForm(), { Origin: 'https://untrusted.example' })).status, 403);
});
test('config reports missing values without pretending credentials work', () => {
  assert.equal(getConfig({ AI_ENABLED: 'true' }).configured, false);
  assert.equal(getConfig({}).enabled, false);
  assert.throws(() => getConfig({ AI_TIMEOUT_MS: '-1' }));
});
test('mocked authentication, quota and network failures return sanitized errors', async t => {
  for (const [upstreamCode, expected] of [[401, 'AI_ACCESS'], [403, 'AI_ACCESS'], [429, 'AI_QUOTA'], ['ECONNRESET', 'AI_UNAVAILABLE']]) {
    const { post } = await serve(t, { analyze: async () => { throw Object.assign(new Error('private-upstream-detail'), { code: upstreamCode }); } });
    const response = await post(); const body = await response.json();
    assert.equal(response.status, 503); assert.equal(body.error.code, expected);
    assert.ok(!JSON.stringify(body).includes('private-upstream-detail'));
  }
});
test('mocked incomplete Gemini results are rejected, not passed to the editor', async t => {
  for (const field of ['evidence', 'uncertainty', 'missingInformation']) {
    const value = fixture(); delete value[field];
    const { post } = await serve(t, { analyze: async () => value });
    const response = await post(); assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'INVALID_AI_RESPONSE');
  }
});
