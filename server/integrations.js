// Configuration inventory is not a connectivity or permission check. Never return values of secrets.
import {instagramConfig} from './instagram-provider.js';
export function integrationStatus(env=process.env){
 const required=keys=>keys.filter(key=>!env[key]);
 const instagram=instagramConfig(env);
 return {
  supabase:{state:env.SUPABASE_URL&&(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY)?'configured_requires_live_verification':'setup_required'},
  gemini:{provider:env.GEMINI_PROVIDER||'vertex',verification:'not_probed_by_status_endpoint'},
  instagram:{state:instagram.configured?'configured_requires_live_verification':'setup_required',missing:instagram.missing,message:'Instagram requires seller authorization, applied database migration and a verified business. Check /api/instagram/status for your connection. Configuration alone does not confirm publishing.'},
  storage:{state:'not_connected',missing:required(['GOOGLE_CLOUD_PROJECT','GCS_BUCKET']),verification:'No storage adapter or live upload configured.'},
  bigquery:{state:'not_connected',missing:required(['GOOGLE_CLOUD_PROJECT','BIGQUERY_DATASET','BIGQUERY_TABLE','BIGQUERY_LOCATION']),verification:'No BigQuery adapter or live write configured.'},
  vertex:{state:env.GEMINI_PROVIDER==='vertex'?'configuration_requires_live_verification':'not_selected',missing:required(['GOOGLE_CLOUD_PROJECT','GOOGLE_CLOUD_LOCATION']),verification:'Existing Vertex adapter available; ADC, API access and model availability require verification.'},
  sarvam:{state:env.SARVAM_API_KEY?'configured_requires_live_verification':'setup_required',missing:required(['SARVAM_API_KEY']),message:env.SARVAM_API_KEY?'Sarvam key is set; this only confirms a key is present, not that it is valid.':'Sarvam text-to-speech is not configured. The device voice preview remains available.'}
 };
}
