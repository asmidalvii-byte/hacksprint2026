export function getConfig(env = process.env) {
  const number = (name, fallback, max) => {
    const value = Number(env[name] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${name}`);
    return value;
  };
  const provider = env.GEMINI_PROVIDER || 'vertex';
  if (!['vertex', 'api-key'].includes(provider)) throw new Error('Invalid GEMINI_PROVIDER');
  const enabled = env.AI_ENABLED === 'true';
  const missing = [];
  if (!env.GEMINI_MODEL) missing.push('GEMINI_MODEL');
  if (provider === 'vertex') {
    if (!env.GOOGLE_CLOUD_PROJECT) missing.push('GOOGLE_CLOUD_PROJECT');
    if (!env.GOOGLE_CLOUD_LOCATION) missing.push('GOOGLE_CLOUD_LOCATION');
  } else if (!env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
  return {
    provider, enabled, missing, configured: enabled && missing.length === 0,
    model: env.GEMINI_MODEL, project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION, apiKey: env.GEMINI_API_KEY,
    sarvamApiKey: env.SARVAM_API_KEY || '', sarvamModel: env.SARVAM_MODEL || 'bulbul:v3',
    sarvamConfigured: Boolean(env.SARVAM_API_KEY),
    timeoutMs: number('AI_TIMEOUT_MS', 30000, 120000),
    maxUploadBytes: number('MAX_UPLOAD_BYTES', 10485760, 10485760),
    port: number('PORT', 3000, 65535), host: env.HOST || '127.0.0.1'
  };
}
