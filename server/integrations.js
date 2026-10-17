// Configuration inventory is not a connectivity or permission check. Never return values of secrets.
export function integrationStatus(env=process.env){
 const required=keys=>keys.filter(key=>!env[key]);
 const instagramMissing=required(['INSTAGRAM_ACCOUNT_ID','INSTAGRAM_ACCESS_TOKEN','INSTAGRAM_API_VERSION']);
 return {
  gemini:{provider:env.GEMINI_PROVIDER||'vertex',verification:'not_probed_by_status_endpoint'},
  instagram:{state:'setup_required',missing:instagramMissing,message:'Instagram publishing setup required. Official account authorization and a verified publishing adapter are not connected. Use Copy Caption, Download Creative, Export Draft or WhatsApp. No post has been sent.'},
  storage:{state:'not_connected',missing:required(['GOOGLE_CLOUD_PROJECT','GCS_BUCKET']),verification:'No storage adapter or live upload configured.'},
  bigquery:{state:'not_connected',missing:required(['GOOGLE_CLOUD_PROJECT','BIGQUERY_DATASET','BIGQUERY_TABLE','BIGQUERY_LOCATION']),verification:'No BigQuery adapter or live write configured.'},
  vertex:{state:env.GEMINI_PROVIDER==='vertex'?'configuration_requires_live_verification':'not_selected',missing:required(['GOOGLE_CLOUD_PROJECT','GOOGLE_CLOUD_LOCATION']),verification:'Existing Vertex adapter available; ADC, API access and model availability require verification.'},
  sarvam:{state:env.SARVAM_API_KEY?'configured_requires_live_verification':'setup_required',missing:required(['SARVAM_API_KEY']),message:env.SARVAM_API_KEY?'Sarvam key is set; this only confirms a key is present, not that it is valid.':'Sarvam text-to-speech is not configured. The device voice preview remains available.'}
 };
}
