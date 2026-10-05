import { createLocalPeerFixture } from './local-peer-fixture.mjs';
import { chromium } from '@playwright/test';

const fixture=await createLocalPeerFixture();
let browser;
const close=async()=>{await browser?.close();await fixture.close();process.exit(0);};
process.once('SIGINT',close);process.once('SIGTERM',close);
console.log(JSON.stringify({tracker:fixture.trackerUrl,authorizedGeneratedFile:fixture.file,mediaHttpServer:false}));
console.log('Leave this command running. This is only a local signaling tracker, not a seed. Ctrl-C cleans up.');
if(process.argv.includes('--open')) {
 try {
  browser=await chromium.launch({headless:false,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  // Only these disposable local experiment contexts accept the ephemeral certificate.
  // No browser profile, system trust store or deployed TLS policy is modified.
  for(const role of ['seed','receiver']) {
   const context=await browser.newContext({ignoreHTTPSErrors:true});
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:4173/nostr-torrent/');
   await page.getByRole('button',{name:'Controlled P2P demo',exact:true}).click();
   await page.getByLabel('WSS tracker').fill(fixture.trackerUrl);
   if(role==='seed')await page.getByRole('button',{name:'Seed a local file',exact:true}).click();
  }
  console.log('Two isolated windows opened. Select the generated file in the seed window; consent and Start seeding. Copy its hash to the receiver, consent, load metadata, choose MP4, play.');
 }catch(error){console.error(error);await browser?.close();await fixture.close();process.exitCode=1;}
}
