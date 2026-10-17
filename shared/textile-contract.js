const text={type:['string','null'],maxLength:1000};
const string={type:'string',minLength:1,maxLength:1000};
const list=(items,maxItems=12)=>({type:'array',items,maxItems});
const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const ids=list({type:'string',minLength:1,maxLength:80});
const confidence={type:'string',enum:['low','medium','high','not_assessable']};
const observation=keys=>object({...Object.fromEntries(keys.map(k=>[k,text])),confidence,visual_evidence:ids});
export const supportedClaim=object({value:text,evidenceIds:ids});
export const textileSchema=object({
 product_identity:object({product_type:supportedClaim,subcategory:supportedClaim}),
 visual_analysis:observation(['main_body_colour','colour_alternatives','secondary_colours','border_colours','decoration_colours','background_and_lighting','image_limitations']),
 textile_analysis:object({
  applicability:{type:'string',enum:['textile','non_textile','uncertain']},
  micro_texture:observation(['observed_texture','visible_weave_pattern','surface_regularity','surface_decoration','possible_interpretation']),
  reflection:observation(['surface_finish','sheen_type','reflection_characteristics','directional_sheen_observed','metallic_looking_details','possible_material_implications']),
  drape:observation(['drape_appearance','fold_characteristics','apparent_stiffness','apparent_fabric_weight','drape_based_hypotheses']),
  opacity:observation(['apparent_opacity','translucency_evidence','visible_layering','possible_material_implications']),
  saree:observation(['body_texture','border_description','pallu_description','visible_motifs','motif_placement_and_density','decoration_technique_hypotheses','image_limitations'])
 }),
 material_hypotheses:list(object({material_name:string,likelihood_label:{type:'string',enum:['possible','plausible','likely']},confidence,supporting_visual_evidence:ids,contradicting_or_ambiguous_evidence:list(string),alternative_explanations:list(string),verification_method:string}),5),
 regional_style_hypotheses:list(object({possible_regional_style:string,supporting_visual_clues:ids,unverified_assumptions:list(string),confidence,source_status:{type:'string',enum:['visual_resemblance_only_no_database_queried']}}),3),
 condition_analysis:observation(['visible_condition','visible_defects','edge_and_finish_observations','possible_interpretation']),
 category_and_tags:object({keywords:list(supportedClaim),tags:list(supportedClaim),suggested_uses:list(supportedClaim)}),
 listing_content:object({marketplace_description:supportedClaim,selling_points:list(supportedClaim,5)}),
 marketing_content:object({status:{type:'string',enum:['not_generated_pending_seller_review']}}),
 pricing_analysis:object({status:{type:'string',enum:['separate_pricing_advisor_no_visual_price_estimate']}}),
 seller_confirmed_facts:list(object({field:string,value:string,evidenceIds:ids,verification:{type:'string',enum:['seller_reported_not_independently_verified']}})),
 missing_information:list(string),
 seller_questions:list(object({question:string,priority:{type:'string',enum:['essential','helpful','optional']},reason:string}),5),
 evidence_and_uncertainty:object({limitations:list(string),unknown_or_unverified:list(string)}),
 review_status:{type:'string',enum:['pending']}
});
