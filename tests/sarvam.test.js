import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceSynth, maxTextLength } from '../server/sarvam.js';
import { createApp } from '../server/app.js';
import { getConfig } from '../server/config.js';
const config = { ...getConfig({ SARVAM_API_KEY: 'test-placeholder-key' }), timeoutMs: 1000 };
test('Sarvam adapter sends the documented REST request shape and decodes audio', async () => {
  let request;
  const synth = createVoiceSynth(config, async (url, init) => { request = { url, init }; return { ok: true, json: async () => ({ audios: ['QUJD'], request_id: 'req-1' }) }; });
  const result = await synth({ text: 'Hello from the shop', language: 'hi' });
  assert.equal(request.url, 'https://api.sarvam.ai/text-to-speech');
  assert.equal(request.init.headers['api-subscription-key'], 'test-placeholder-key');
  const body = JSON.parse(request.init.body);
  assert.equal(body.language_code, 'hi-IN');
  assert.equal(body.model, 'bulbul:v3');
  assert.equal(body.text, 'Hello from the shop');
  assert.equal(result.audio, 'QUJD');
  assert.equal(result.format, 'wav');
  assert.equal(result.model, 'bulbul:v3');
});
test('Sarvam text limit is model-aware: bulbul:v2 caps lower than v3/v4-flash', () => {
  assert.equal(maxTextLength('bulbul:v2'), 1500);
  assert.equal(maxTextLength('bulbul:v3'), 2500);
  assert.equal(maxTextLength('bulbul:v4-flash'), 2500);
});
test('Sarvam adapter enforces the configured model\'s own text limit, not a fixed one', async () => {
  const v2Config = { ...config, sarvamModel: 'bulbul:v2' };
  const synth = createVoiceSynth(v2Config, async () => { throw new Error('must not call the network'); });
  await assert.rejects(synth({ text: 'x'.repeat(1600), language: 'hi' }));
  const okSynth = createVoiceSynth(v2Config, async () => ({ ok: true, json: async () => ({ audios: ['QUJD'] }) }));
  await assert.doesNotReject(okSynth({ text: 'x'.repeat(1400), language: 'hi' }));
});
test('Sarvam adapter rejects unsupported languages and oversize or empty text before calling the API', async () => {
  const synth = createVoiceSynth(config, async () => { throw new Error('must not call the network'); });
  await assert.rejects(synth({ text: 'hi', language: 'fr' }));
  await assert.rejects(synth({ text: '', language: 'hi' }));
  await assert.rejects(synth({ text: 'x'.repeat(2501), language: 'hi' }));
});
test('Sarvam adapter never fabricates audio on a malformed or failed response', async () => {
  const unreadable = createVoiceSynth(config, async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }));
  await assert.rejects(unreadable({ text: 'hi', language: 'hi' }));
  const missingAudio = createVoiceSynth(config, async () => ({ ok: true, json: async () => ({ audios: [] }) }));
  await assert.rejects(missingAudio({ text: 'hi', language: 'hi' }));
  const failed = createVoiceSynth(config, async () => ({ ok: false, status: 403, json: async () => ({ error: { message: 'invalid-api-key-secret' } }) }));
  await assert.rejects(failed({ text: 'hi', language: 'hi' }), err => { assert.equal(err.status, 403); return true; });
});
test('POST /api/voice-ad reports honest setup-required status and never calls Sarvam when unconfigured', async t => {
  const server = createApp({ config: { ...getConfig({}), timeoutMs: 1000 }, synthesizeVoice: async () => { throw new Error('must not run'); } }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => { server.closeAllConnections(); server.close(r); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = body => fetch(base + '/api/voice-ad', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const response = await post({ text: 'Ad script', language: 'hi', reviewed: true });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'SARVAM_SETUP_REQUIRED');
});
test('POST /api/voice-ad validates input and returns generated audio only when reviewed and configured', async t => {
  const server = createApp({ config: { ...getConfig({ SARVAM_API_KEY: 'k' }), timeoutMs: 1000 }, synthesizeVoice: async () => ({ audio: 'QUJD', format: 'wav', model: 'bulbul:v3', generatedAt: 'now' }) }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => { server.closeAllConnections(); server.close(r); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = body => fetch(base + '/api/voice-ad', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({ text: 'Ad script', language: 'hi', reviewed: false })).status, 400);
  assert.equal((await post({ text: 'Ad script', language: 'xx', reviewed: true })).status, 400);
  const ok = await post({ text: 'Ad script', language: 'hi', reviewed: true });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.audio, 'QUJD'); assert.equal(body.provider, 'sarvam');
});
test('Sarvam upstream errors are sanitized like other AI errors', async t => {
  const server = createApp({ config: { ...getConfig({ SARVAM_API_KEY: 'k' }), timeoutMs: 1000 }, synthesizeVoice: async () => { throw Object.assign(new Error('secret-upstream-detail'), { status: 403 }); } }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => { server.closeAllConnections(); server.close(r); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base + '/api/voice-ad', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Ad script', language: 'hi', reviewed: true }) });
  const text = await response.text();
  assert.equal(response.status, 503);
  assert.ok(!text.includes('secret-upstream-detail'));
});

test('English Sarvam uses en-IN without silently changing language (mock)',async()=>{let language;const synth=createVoiceSynth(config,async(_url,init)=>{language=JSON.parse(init.body).language_code;return {ok:true,json:async()=>({audios:['QUJD']})}});await synth({text:'Reviewed English script',language:'en'});assert.equal(language,'en-IN')});
