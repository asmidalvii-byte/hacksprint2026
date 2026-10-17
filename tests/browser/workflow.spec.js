import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { envelope } from '../fixture.js';
const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#2456aa' } }).png().toBuffer();
async function upload(page) { await page.locator('#file').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: png }); await expect(page.locator('#uploadLabel')).toHaveText('test.png'); }
async function mockAI(page, value = envelope()) { await page.route('**/api/analyze-product', route => route.fulfill({ json: value })); }
async function exportJSON(page) {
  const download = page.waitForEvent('download'); await page.locator('#export').click();
  const stream = await (await download).createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}
test('sample journey retains merchant pricing and truthful export', async ({ page }) => {
  await page.goto('/index.html'); await page.locator('#sample').click(); await page.locator('#price').fill('1299.50'); await page.locator('#priceApproved').check(); await page.locator('#includePrice').check();
  await page.locator('#confirmed').check(); page.on('dialog', d => d.accept()); await page.locator('#fallback').click();
  await expect(page.locator('#price')).toHaveValue('1299.50'); await expect(page.locator('#includePrice')).toBeChecked(); await expect(page.locator('#confirmed')).not.toBeChecked();
  await page.locator('#confirmed').check(); const data = await exportJSON(page);
  expect(data.product.price).toEqual({ currency: 'INR', value: '1299.50', source: 'merchant' }); expect(data.provenance.image_analysis).toBe('not_performed'); expect(data.analysis).toBeNull();
});
test('mocked image analysis, evidence review, editor, language and export', async ({ page }) => {
  await mockAI(page); await page.goto('/index.html'); await upload(page); await page.locator('#generate').click();
  await expect(page.locator('#analysisPanel')).toBeVisible(); await expect(page.locator('#analysisDetails')).toContainText('fabric composition');
  await expect(page.locator('#title')).toHaveValue('Blue patterned textile');
  await page.locator('#price').fill('799'); await page.locator('#priceApproved').check(); await page.locator('#includePrice').check(); await page.locator('#confirmed').check();
  await page.locator('#language').selectOption('ta'); await expect(page.locator('#confirmed')).not.toBeChecked();
  await page.locator('#confirmed').check(); const data = await exportJSON(page);
  expect(data.product.price.value).toBe('799.00'); expect(data.analysis.merchantReview.status).toBe('approved'); expect(data.ad.language).toBe('ta'); expect(data.analysis.evidence).toHaveLength(1);
});
test('AI reanalysis does not replace edits or prices without applying', async ({ page }) => {
  await mockAI(page); await page.goto('/index.html'); await upload(page); await page.locator('#fallback').click();
  await page.locator('#title').fill('Merchant title'); await page.locator('#material').fill('Cotton confirmed by seller'); await page.locator('#price').fill('500');
  await page.locator('#generate').click(); await expect(page.locator('#analysisPanel')).toBeVisible(); await expect(page.locator('#title')).toHaveValue('Merchant title');
  page.on('dialog', d => d.accept()); await page.locator('#applyAnalysis').click();
  await expect(page.locator('#price')).toHaveValue('500'); await expect(page.locator('#material')).toHaveValue('Cotton confirmed by seller');
});
test('service unavailable keeps listing and offers fallback', async ({ page }) => {
  await page.goto('/index.html'); await upload(page); await page.locator('#fallback').click(); await page.locator('#price').fill('200');
  await page.locator('#generate').click(); await expect(page.locator('#aiStatus')).toContainText('not configured'); await expect(page.locator('#price')).toHaveValue('200');
  await expect(page.locator('#title')).toHaveValue('Saree for everyday celebrations');
});
test('new product clears old price and ignores stale analysis', async ({ page }) => {
  let release; const waiting = new Promise(resolve => release = resolve);
  await page.route('**/api/analyze-product', async route => { await waiting; await route.fulfill({ json: envelope() }).catch(() => {}); });
  await page.goto('/index.html'); await upload(page); await page.locator('#fallback').click(); await page.locator('#price').fill('500'); await page.locator('#generate').click();
  await expect(page.locator('#generate')).toBeDisabled();
  await page.locator('#file').setInputFiles({ name: 'second.png', mimeType: 'image/png', buffer: png }); await expect(page.locator('#uploadLabel')).toHaveText('second.png');
  release(); await expect(page.locator('#analysisPanel')).toBeHidden(); await page.locator('#fallback').click(); await expect(page.locator('#price')).toHaveValue('');
});
test('all categories and language templates remain available', async ({ page }) => {
  await page.goto('/index.html'); await page.locator('#sample').click(); page.on('dialog', d => d.accept());
  for (const category of ['saree', 'pot', 'jewelry', 'other']) {
    await page.locator('#category').selectOption(category); await page.locator('#fallback').click(); await expect(page.locator('#title')).not.toHaveValue('');
  }
  for (const lang of ['hi', 'ta', 'te', 'kn', 'bn']) { await page.locator('#language').selectOption(lang); await expect(page.locator('#ad')).not.toHaveValue(''); }
});
test('review is required and model text cannot execute markup', async ({ page }) => {
  const result = envelope(); result.evidence[0].observation = '<img src=x onerror="window.injected=true">';
  await mockAI(page, result); await page.goto('/index.html'); await upload(page); await page.locator('#generate').click();
  await expect(page.locator('#analysisDetails')).toContainText('<img'); expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await page.locator('#export').click(); await expect(page.locator('#toast')).toContainText('Review the details');
  await page.locator('#play').click(); await expect(page.locator('#toast')).toContainText('confirmation');
});
test('voice absence is explained and mobile layout stays within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/index.html'); await page.locator('#sample').click(); await page.locator('#confirmed').check();
  await page.evaluate(() => { speechSynthesis.getVoices = () => []; }); await page.locator('#play').click();
  await expect(page.locator('#voiceStatus')).toContainText('No matching voice');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('accepted analysis provenance survives seller edits to notes', async ({ page }) => {
  await mockAI(page); await page.goto('/index.html'); await upload(page); await page.locator('#generate').click();
  await expect(page.locator('#analysisPanel')).toBeVisible(); await expect(page.locator('#listing')).toBeVisible();
  await page.locator('#notes').fill('Seller adds a detail after analysis'); await page.locator('#confirmed').check();
  const data = await exportJSON(page); expect(data.analysis.requestId).toBe('test-only'); expect(data.provenance.image_analysis).toBe('gemini');
});
