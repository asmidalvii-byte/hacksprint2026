// Structural/evidence checks are not a textile classifier or proof of truth.
const sensitive=/\b(?:antique|vintage|earthenware|terracotta|stoneware|silk|cotton|linen|wool|polyester|viscose|nylon|handloom|handmade|woven|embroidered|printed|hand[- ]woven|pure|authentic|certified|naturally dyed|genuine zari|real gold|real silver|blouse (?:piece )?included|includes? (?:a )?blouse)\b/i;
export function validateTextile(value,fail){
 const detail=value.intelligence;if(!detail)return;
 const evidence=new Map(value.evidence.map(e=>[e.id,e]));
 const imageIds=ids=>ids.length>0&&ids.every(id=>evidence.get(id)?.kind==='image');
 const sellerIds=ids=>ids.some(id=>evidence.get(id)?.kind==='merchant_text');
 function walk(node){if(!node||typeof node!=='object')return;
  for(const [k,v]of Object.entries(node)){
   if(['evidenceIds','visual_evidence','supporting_visual_evidence','supporting_visual_clues'].includes(k)){
    if(v.some(id=>!evidence.has(id))||new Set(v).size!==v.length)fail();
    if(k!=='evidenceIds'&&v.some(id=>evidence.get(id)?.kind!=='image'))fail();
   }else walk(v);
  }
  if('value'in node&&'evidenceIds'in node&&node.value!==null&&(!node.value.trim()||!node.evidenceIds.length))fail();
  if('visual_evidence'in node&&node.confidence!=='not_assessable'&&!imageIds(node.visual_evidence))fail();
 }
 walk(detail);
 for(const h of detail.material_hypotheses)if(!imageIds(h.supporting_visual_evidence)||!h.alternative_explanations.length||!h.contradicting_or_ambiguous_evidence.length||h.contradicting_or_ambiguous_evidence.some(item=>evidence.has(item))||h.confidence==='not_assessable')fail();
 for(const h of detail.regional_style_hypotheses)if(!imageIds(h.supporting_visual_clues)||!h.unverified_assumptions.length)fail();
 for(const f of detail.seller_confirmed_facts)if(!f.evidenceIds.length||f.evidenceIds.some(id=>evidence.get(id)?.kind!=='merchant_text'))fail();
 const claims=[value.title,value.description,detail.product_identity.product_type,detail.product_identity.subcategory,detail.listing_content.marketplace_description,...detail.listing_content.selling_points,...Object.values(detail.category_and_tags).flat()];
 for(const c of claims)if(c.value&&sensitive.test(c.value)&&!sellerIds(c.evidenceIds))fail();
 if(detail.textile_analysis.applicability==='non_textile'&&detail.material_hypotheses.some(h=>/silk|cotton|linen|wool|polyester|viscose|nylon/i.test(h.material_name)))fail();
}
