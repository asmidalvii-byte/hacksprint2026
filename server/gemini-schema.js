import { visionSchema } from '../shared/analysis-contract.js';
// Gemini's native responseSchema is a subset of JSON Schema. Keep the full
// application contract for Ajv; map nullable values and enums explicitly here.
export function toResponseSchema(schema) {
  if (schema.anyOf) {
    const nonNull = schema.anyOf.find(item => item.type !== 'null');
    return { ...toResponseSchema(nonNull), nullable: schema.anyOf.some(item => item.type === 'null') };
  }
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const result = { type: types.find(type => type !== 'null').toUpperCase() };
  if (types.includes('null')) result.nullable = true;
  if (schema.enum) result.enum = schema.enum.filter(value => value !== null);
  if (schema.properties) result.properties = Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, toResponseSchema(value)]));
  if (schema.required) result.required = schema.required;
  if (schema.items) result.items = toResponseSchema(schema.items);
  return result;
}
export const geminiResponseSchema = toResponseSchema(visionSchema);
