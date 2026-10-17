import { AppError } from './errors.js';
// https://docs.sarvam.ai/api-reference/text-to-speech/convert : POST /text-to-speech,
// header api-subscription-key, body {text, language_code, model}, response {audios:[base64 wav], request_id}.
const LANGUAGE_CODES = { hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', bn: 'bn-IN' };
// bulbul:v2 caps text at 1500 chars; v3 and v4-flash cap at 2500 (per the docs above).
const MAX_TEXT_LENGTH = { 'bulbul:v2': 1500, 'bulbul:v3': 2500, 'bulbul:v4-flash': 2500 };
export function maxTextLength(model) { return MAX_TEXT_LENGTH[model] || 1500; }
export function createVoiceSynth(config, fetchImpl = fetch) {
  return async ({ text, language }) => {
    const languageCode = LANGUAGE_CODES[language];
    if (!languageCode) throw new AppError('INVALID_INPUT', 'Unsupported language for voice generation.', 400);
    const limit = maxTextLength(config.sarvamModel);
    if (typeof text !== 'string' || !text.trim() || text.length > limit) throw new AppError('INVALID_INPUT', `Ad script must be 1-${limit} characters for ${config.sarvamModel}.`, 400);
    const response = await fetchImpl('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': config.sarvamApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language_code: languageCode, model: config.sarvamModel }),
      signal: AbortSignal.timeout(config.timeoutMs)
    });
    let body;
    try { body = await response.json(); } catch { throw Object.assign(new Error('Sarvam returned an unreadable response.'), { status: response.status }); }
    if (!response.ok) throw Object.assign(new Error(body?.error?.message || 'Sarvam request failed.'), { status: response.status });
    if (!Array.isArray(body.audios) || typeof body.audios[0] !== 'string' || !body.audios[0]) throw new AppError('INVALID_AI_RESPONSE', 'Sarvam returned no audio.', 502);
    return { audio: body.audios[0], format: 'wav', model: config.sarvamModel, requestId: body.request_id || null, generatedAt: new Date().toISOString() };
  };
}
