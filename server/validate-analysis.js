import { validateTextile } from './validate-textile.js';
import Ajv from 'ajv';
import { analysisSchema } from '../shared/analysis-contract.js';
import { AppError } from './errors.js';
const validate = new Ajv({ strict: true, allowUnionTypes: true }).compile(analysisSchema);
export function validateAnalysis(value, { hasNotes = false, requireIntelligence = false } = {}) {
  const fail = () => { throw new AppError('INVALID_AI_RESPONSE', 'AI returned an unsupported result. Try again or use a sample draft.'); };
  if (!validate(value) || requireIntelligence && !value.intelligence) fail();
  const ids = new Set();
  for (const e of value.evidence) {
    if (ids.has(e.id) || (e.kind === 'image' && e.inputId !== 'image-1') ||
      (e.kind === 'merchant_text' && (e.inputId !== 'notes-1' || !hasNotes))) fail();
    ids.add(e.id);
  }
  for (const claim of [value.title, value.description, value.category, ...value.visibleAttributes]) {
    if (claim.value !== null && (!claim.value.trim() || claim.evidenceIds.length === 0)) fail();
    if (claim.evidenceIds.some(id => !ids.has(id)) || new Set(claim.evidenceIds).size !== claim.evidenceIds.length) fail();
  }
  validateTextile(value, fail);
  return value;
}
