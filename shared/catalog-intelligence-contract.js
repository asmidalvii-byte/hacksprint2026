import { textileSchema } from './textile-contract.js';
import { pricingSchema } from './pricing-contract.js';
// Export enrichment is separate from the vision contract: no model controls prices or approval.
const text={type:'string'},strings={type:'array',items:text};
export const catalogIntelligenceSchema={...textileSchema,properties:{...textileSchema.properties,
 product_identity:{...textileSchema.properties.product_identity,properties:{...textileSchema.properties.product_identity.properties,merchant_edited_title:text}},
 pricing_analysis:pricingSchema,
 marketing_content:{anyOf:[{type:'null'},{type:'object',additionalProperties:false,required:['language','instagram_caption','hashtags','marketplace_description','whatsapp_message','voice_ad','alternative_captions','source','review_status'],properties:{language:{type:'string',enum:['en','hi','ta','te','kn','bn']},instagram_caption:text,hashtags:strings,marketplace_description:text,whatsapp_message:text,voice_ad:text,alternative_captions:strings,source:text,model:text,generated_at:text,review_status:{type:'string',enum:['pending','approved']}}}]},
 review_status:{type:'string',enum:['pending','approved']}
}};
