import {installSellers, sellerConfig} from './sellers.js';
import { integrationStatus } from './integrations.js';
import {createInstagram} from './instagram.js';
import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { categories } from '../shared/analysis-contract.js';
import { validateAnalysis } from './validate-analysis.js';
import { AppError } from './errors.js';
import { createAnalyzer } from './gemini.js';
import { createMarketing } from './marketing.js';
import { createPricing } from './pricing.js';
import { createVoiceSynth } from './sarvam.js';
const root = fileURLToPath(new URL('../', import.meta.url));
export function createApp({ config, analyze = createAnalyzer(config), priceProduct = createPricing(config), marketProduct = createMarketing(config), synthesizeVoice = createVoiceSynth(config), accounts = sellerConfig(), sellerClientFactory, instagram = createInstagram() }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store',
      'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' blob: data:; media-src 'self' data:; connect-src 'self' ${accounts.configured?new URL(accounts.url).origin:''}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'` });
    next();
  });
  instagram.installCallback(app);
  app.get('/api/integrations', (req,res)=>res.json(integrationStatus()));
  app.get('/api/status', (req, res) => res.json({ aiEnabled: config.enabled, configured: config.configured, provider: config.provider, requestTimeoutMs: config.timeoutMs + 10000, verification: 'not_verified_by_status_endpoint', storage: 'not_configured', analytics: 'not_configured' }));
  app.use('/api', (req, res, next) => {
    // Browsers must use this backend's origin. No wildcard CORS or cross-site uploads.
    if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'Use the app from its own server address.' } });
    const origin = req.get('origin');
    if (origin) {
      try { if (new URL(origin).host !== req.get('host')) throw new Error(); }
      catch { return res.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'Use the app from its own server address.' } }); }
    }
    next();
  });
  installSellers(app,{settings:accounts,clientFactory:sellerClientFactory});
  instagram.installRoutes(app);
  const limiter = rateLimit({ windowMs: 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Wait a minute or use a sample draft.' } } });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1, fields: 2, fieldSize: 10000, parts: 3 } });
  let active = 0;
  app.post('/api/analyze-product', limiter, (req, res, next) => {
    if (!config.configured) return next(new AppError('AI_UNAVAILABLE', 'AI is not configured. You can use the sample demo.', 503));
    if (active >= 2) return next(new AppError('AI_BUSY', 'Analysis is busy. Try again shortly.', 503));
    active++;
    let released = false;
    const release = () => { if (!released) { active--; released = true; } };
    res.once('finish', release); res.once('close', release); next();
  }, upload.single('image'), async (req, res, next) => {
    let timer;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    res.once('close', cancel);
    try {
      if (!req.file) throw new AppError('INVALID_UPLOAD', 'Choose a product image first.', 400);
      if (Object.keys(req.body).some(k => !['notes', 'category'].includes(k))) throw new AppError('INVALID_INPUT', 'Unsupported request fields.', 400);
      const { notes = '', category = '' } = req.body;
      if (typeof notes !== 'string' || notes.length > 4000 || typeof category !== 'string' || category && !categories.includes(category)) throw new AppError('INVALID_INPUT', 'Use a valid category and notes under 4,000 characters.', 400);
      let type;
      try { type = await fileTypeFromBuffer(req.file.buffer); }
      catch { throw new AppError('INVALID_UPLOAD', 'This image is incomplete or corrupt.', 400); }
      if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime) || type.mime !== req.file.mimetype) throw new AppError('INVALID_UPLOAD', 'Choose a valid JPG, PNG or WebP image.', 400);
      let bytes;
      try {
        // Decode fully, bound pixels, resize for analysis and remove EXIF metadata.
        bytes = await sharp(req.file.buffer, { limitInputPixels: 40000000, failOn: 'warning' }).rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
      } catch { throw new AppError('INVALID_UPLOAD', 'This image cannot be decoded or exceeds the pixel limit.', 400); }
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new AppError('AI_TIMEOUT', 'Analysis timed out. Retry or use a sample draft.', 504)); }, config.timeoutMs); });
      const result = await Promise.race([analyze({ bytes, mimeType: 'image/jpeg', notes: notes.trim(), category, signal: controller.signal }), deadline]);
      validateAnalysis(result, { hasNotes: Boolean(notes.trim()) });
      res.json({ schemaVersion: '1.1', source: 'gemini', requestId: randomUUID(), ...result,
        merchantReview: { status: 'pending', requiredFields: ['title', 'description', 'category', 'material', 'condition', 'price'], approvedFields: [] },
        provenance: { provider: config.provider, model: config.model, analyzedAt: new Date().toISOString(), imageStored: false } });
    } catch (error) { next(error); }
    finally { clearTimeout(timer); res.off('close', cancel); }
  });
  app.post('/api/pricing', limiter, express.json({limit:'16kb'}), async (req,res,next) => {
    const allowed = ['currency','market','location','category','subcategory','material','dimensions','workmanship','accessories','condition','seller_cost','seller_target_margin','sales_channel','target_customer','use_ai'];
    const input = req.body;
    if (!input || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k)) || Object.entries(input).some(([k,v]) => ['seller_cost','seller_target_margin'].includes(k) ? v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || (k === 'seller_cost' ? v > 10000000 : v >= 100)) : k === 'use_ai' ? typeof v !== 'boolean' : typeof v !== 'string' || v.length > 200)) return res.status(400).json({error:{message:'Invalid pricing inputs.'}});
    if (input.currency && !['INR','USD','GBP','EUR'].includes(input.currency)) return res.status(400).json({error:{message:'Unsupported currency.'}});
    if (active >= 2) return res.status(503).json({error:{message:'Service busy. Try again.'}});
    active++;
    try { res.json(await priceProduct(input)); } catch(error) { next(error); } finally { active--; }
  });
  app.post('/api/voice-ad', limiter, express.json({limit:'8kb'}), async (req,res,next) => {
    const input = req.body;
    if (!input || Array.isArray(input) || Object.keys(input).some(k => !['text','language','reviewed'].includes(k)) || input.reviewed !== true || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2500 || !['en','hi','ta','te','kn','bn'].includes(input.language)) return res.status(400).json({ error: { message: 'Review the ad script and choose a supported language first.' } });
    if (!config.sarvamConfigured) return res.status(503).json({ error: { code: 'SARVAM_SETUP_REQUIRED', message: integrationStatus().sarvam.message } });
    if (active >= 2) return res.status(503).json({ error: { message: 'Service busy. Try again.' } });
    active++;
    try { const result = await synthesizeVoice(input); res.json({ audio: result.audio, format: result.format, model: result.model, provider: 'sarvam', generatedAt: result.generatedAt }); }
    catch (error) { next(error); } finally { active--; }
  });
  app.post('/api/marketing', limiter, express.json({limit:'16kb'}), async (req,res,next) => {
    const input=req.body;
    if(!input || Array.isArray(input) || Object.keys(input).some(k=>!['title','description','language','reviewed'].includes(k)) || input.reviewed!==true || typeof input.title!=='string' || !input.title.trim() || input.title.length>150 || typeof input.description!=='string' || input.description.length>2000 || !['en','hi','ta','te','kn','bn'].includes(input.language)) return res.status(400).json({error:{message:'Review the listing and choose a supported language first.'}});
    if(!config.configured) return res.status(503).json({error:{message:'Gemini marketing is not configured. Local templates remain available.'}});
    if(active>=2) return res.status(503).json({error:{message:'Service busy. Try again.'}});
    active++;
    try {res.json(await marketProduct(input));} catch(error){next(error);} finally{active--;}
  });
  app.get('/vendor/supabase.js',(req,res)=>res.sendFile(root+'node_modules/@supabase/supabase-js/dist/umd/supabase.js'));
  app.get('/shared/pricing.js', (req,res) => res.sendFile(root + 'shared/pricing.js'));
  for (const file of ['index.html', 'kriti-ui.css', 'kriti-i18n.js', 'app.js', 'pricing-ui.js', 'intelligence-ui.js', 'account-ui.js', 'workflow-ui.js', 'draft-storage.js', 'draft-persistence.js', 'style.css', 'i18n.js', 'screens.js']) app.get(file === 'index.html' ? ['/', '/index.html'] : `/${file}`, (req, res) => res.sendFile(root + file));
  app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof multer.MulterError) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: { code: 'INVALID_UPLOAD', message: 'Upload one JPG, PNG or WebP image up to 10 MB, with short notes.' } });
    if (error instanceof AppError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    const status = Number(error.status || error.code);
    const code = status === 429 ? 'AI_QUOTA' : [401, 403].includes(status) ? 'AI_ACCESS' : 'AI_UNAVAILABLE';
    // Never forward SDK messages, request bodies, credentials or image data.
    res.status(503).json({ error: { code, message: 'AI is unavailable. Retry later or use a sample draft.' } });
  });
  return app;
}
