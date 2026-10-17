export function testAccountConfig(env=process.env){
 return {
  enabled:env.KRITI_TEST_ACCOUNT_ACCESS==='true'&&env.NODE_ENV!=='production'&&['127.0.0.1','::1','localhost'].includes(env.HOST||'127.0.0.1'),
  emails:[env.TEST_SELLER_A_EMAIL,env.TEST_SELLER_B_EMAIL].filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim().toLowerCase())
 };
}
export function hasTestAccountAccess(user,address,config){
 return config.enabled&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)&&
  typeof user?.email==='string'&&Boolean(user.email_confirmed_at)&&config.emails.includes(user.email.trim().toLowerCase());
}
export const testAccountNotice='Test account — business not verified. Demo drafts are saved on this device only.';
