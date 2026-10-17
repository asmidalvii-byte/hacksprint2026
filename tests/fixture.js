import { textileSchema } from '../shared/textile-contract.js';
function empty(schema){if(Array.isArray(schema.type)&&schema.type.includes('null'))return null;if(schema.type==='object')return Object.fromEntries(Object.entries(schema.properties).map(([k,v])=>[k,empty(v)]));if(schema.type==='array')return [];if(schema.enum)return schema.enum.includes('not_assessable')?'not_assessable':schema.enum[0];return ''; }
export function textileFixture(){const value=empty(textileSchema);value.textile_analysis.applicability='textile';return value;}
// Synthetic response for contract and UI tests. Never a claim of live AI accuracy.
export function fixture() {
  return {
    intelligence: textileFixture(),
    title: { value: 'Blue patterned textile', evidenceIds: ['e1'] },
    description: { value: 'A blue textile with a visible repeating pattern.', evidenceIds: ['e1'] },
    category: { value: 'saree', evidenceIds: ['e1'] },
    visibleAttributes: [{ name: 'Colour', value: 'Blue', evidenceIds: ['e1'] }],
    evidence: [{ id: 'e1', inputId: 'image-1', kind: 'image', observation: 'Blue surface with repeated motifs.' }],
    missingInformation: [{ field: 'material', question: 'What is the fabric composition?' }],
    uncertainty: [{ field: 'category', level: 'medium', reason: 'The entire textile is not visible.' }]
  };
}
export function envelope() {
  return { schemaVersion: '1.0', source: 'gemini', requestId: 'test-only', ...fixture(),
    merchantReview: { status: 'pending', requiredFields: ['material', 'condition', 'price'], approvedFields: [] },
    provenance: { provider: 'test-fixture', model: 'test-fixture', imageStored: false } };
}
