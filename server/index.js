import 'dotenv/config';
import { getConfig } from './config.js';
import { createApp } from './app.js';
const config = getConfig();
createApp({ config }).listen(config.port, config.host, () => {
  console.log(`DukaanScan: http://${config.host}:${config.port}`);
  console.log(config.configured ? 'AI configuration present; live integration still needs testing.' : 'AI disabled or incomplete. Sample demo available.');
});
