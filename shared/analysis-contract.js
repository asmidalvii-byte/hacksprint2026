import { textileSchema } from './textile-contract.js';
export const categories = ['saree', 'pot', 'jewelry', 'other'];
const string = { type: 'string', minLength: 1, maxLength: 2000 };
const list = items => ({ type: 'array', items, maxItems: 30 });
const object = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const evidenceIds = list({ type: 'string', minLength: 1, maxLength: 80 });
const claim = maxLength => object({ value: { type: ['string', 'null'], maxLength }, evidenceIds });
export const analysisSchema = object({
  title: claim(150),
  description: claim(2000),
  category: object({ value: { anyOf: [{ type: 'string', enum: categories }, { type: 'null' }] }, evidenceIds }),
  visibleAttributes: list(object({ name: { ...string, maxLength: 80 }, value: string, evidenceIds })),
  evidence: list(object({ id: { ...string, maxLength: 80 }, inputId: { type: 'string', enum: ['image-1', 'notes-1'] }, kind: { type: 'string', enum: ['image', 'merchant_text'] }, observation: string })),
  missingInformation: list(object({ field: { ...string, maxLength: 80 }, question: string })),
  uncertainty: list(object({ field: { ...string, maxLength: 80 }, level: { type: 'string', enum: ['low', 'medium', 'high', 'unknown'] }, reason: string }))
});

// Optional when reading legacy results; required for every new model request.
analysisSchema.properties.intelligence = textileSchema;
export const visionSchema = { ...analysisSchema, required: [...analysisSchema.required, "intelligence"] };
