import 'dotenv/config';
// List public model identifiers without printing credentials or raw provider errors.
if (!process.env.GEMINI_API_KEY) {
  console.error('MODEL CHECK NOT RUN: save GEMINI_API_KEY in the local .env file first.');
  process.exitCode = 1;
} else {
  try {
    let pageToken = '';
    const names = [];
    do {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('pageSize', '1000');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const response = await fetch(url, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) { console.error('MODEL CHECK FAILED: HTTP ' + response.status + '. Check API key authorization, API enablement and restrictions.'); process.exitCode = 1; break; }
      const data = await response.json();
      for (const model of data.models || []) {
        if (model.supportedGenerationMethods?.includes('generateContent') && /^models\/[a-zA-Z0-9._-]+$/.test(model.name)) names.push(model.name);
      }
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    if (!process.exitCode) {
      console.log('Model-list request succeeded. Image analysis and structured output still need live verification.');
      names.forEach(name => console.log(name));
    }
  } catch { console.error('MODEL CHECK FAILED: network or response error. No credentials or raw provider errors were printed.'); process.exitCode = 1; }
}
