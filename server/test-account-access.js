export function testAccountConfig(env=process.env){
 return {
  enabled:(env.KRITI_TEST_ACCOUNT_ACCESS==='true'||env.KRITI_DEMO_ALL_ACCOUNTS==='true')&&env.NODE_ENV!=='production'&&['127.0.0.1','::1','localhost'].includes(env.HOST||'127.0.0.1'),
  allAccounts:env.KRITI_DEMO_ALL_ACCOUNTS==='true',
  emails:[env.TEST_SELLER_A_EMAIL,env.TEST_SELLER_B_EMAIL].filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim().toLowerCase())
 };
}
export function hasTestAccountAccess(user,address,config){
 return config.enabled&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)&&
  (config.allAccounts?Boolean(user?.id):typeof user?.email==='string'&&Boolean(user.email_confirmed_at)&&config.emails.includes(user.email.trim().toLowerCase()));
}
export const testAccountNotice='Demo access — business not verified. Drafts are saved on this device only.';
