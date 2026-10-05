import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
// Real loopback WSS signaling and a generated, non-HTTP-served MP4.
// @ts-expect-error local Node-only infrastructure module
import { createLocalPeerFixture } from '../scripts/local-peer-fixture.mjs';

declare global { interface Window { __rtc:RTCPeerConnection[]; } }

test('stop during engine import prevents late tracker connections',async({page})=>{
 let release!:()=>void;let arrived!:()=>void;
 const pending=new Promise<void>(r=>{arrived=r;});const hold=new Promise<void>(r=>{release=r;});
 const sockets:string[]=[];page.on('websocket',ws=>sockets.push(ws.url()));
 await page.route('**/webtorrent.min-*.js',async route=>{arrived();await hold;await route.continue();});
 await page.goto('./');await page.getByRole('button',{name:'Controlled P2P demo',exact:true}).click();
 await page.getByLabel('WSS tracker').fill('wss://127.0.0.1:1');await page.getByLabel('Torrent info hash').fill('a'.repeat(40));await page.getByLabel('I consent to P2P IP exposure and upload bandwidth.').check();
 await page.getByRole('button',{name:'Load peer metadata',exact:true}).click();await pending;
 await page.getByRole('button',{name:'Stop P2P & clear session',exact:true}).click();release();
 await page.waitForTimeout(500);await expect(page.getByRole('status')).toContainText('Stopped.');expect(sockets).toEqual([]);await expect(page.locator('video')).not.toHaveAttribute('src');
});

test('controlled peer-only seed → metadata → selected MP4 → early playback', async ({ browser }, info) => {
 test.setTimeout(100000);
 const fixture=await createLocalPeerFixture();
 const {trackerUrl}=fixture;
 const contextOptions={ignoreHTTPSErrors:true,viewport:info.project.use.viewport};
 const seedContext=await browser.newContext(contextOptions), receiveContext=await browser.newContext(contextOptions);
 for(const context of [seedContext,receiveContext])await context.addInitScript(()=>{window.__rtc=[];const Original=window.RTCPeerConnection;window.RTCPeerConnection=class extends Original{constructor(config?:RTCConfiguration){super(config);window.__rtc.push(this);}};});
 seedContext.setDefaultTimeout(10000);receiveContext.setDefaultTimeout(10000);
 const seed=await seedContext.newPage(), receiver=await receiveContext.newPage();
 const networkMedia:string[]=[], unexpectedHttp:string[]=[], sockets:string[]=[], errors:string[]=[];
 for(const page of [seed,receiver])page.on('websocket',socket=>sockets.push(socket.url()));
 receiver.on('pageerror',e=>errors.push(e.message));seed.on('pageerror',e=>errors.push(e.message));
 // Context routing observes real network traffic, not worker-produced local range responses.
 await receiveContext.route('**/*',route=>{const r=route.request();const u=new URL(r.url());if(u.origin!=='http://127.0.0.1:4173'||!(/^\/nostr-torrent\/(?:assets\/[^/]+|sw.min.js)?$/.test(u.pathname)))unexpectedHttp.push(r.url());if(r.resourceType()==='media'||/\.mp4(?:\?|$)/.test(r.url()))networkMedia.push(r.url());return route.continue();});
 try {
  for(const page of [seed,receiver]){await page.goto('http://127.0.0.1:4173/nostr-torrent/');await page.getByRole('button',{name:'Controlled P2P demo',exact:true}).click();await page.getByLabel('WSS tracker').fill(trackerUrl);}
  await seed.getByRole('button',{name:'Seed a local file',exact:true}).click();
  await seed.getByLabel('Authorized MP4 file').setInputFiles(fixture.file);
  await seed.getByLabel('I consent to P2P IP exposure and upload bandwidth.').check();
  await seed.getByRole('button',{name:'Start seeding',exact:true}).click();
  await expect(seed.getByTestId('seed-hash')).toHaveText(/^[a-f0-9]{40}$/,{timeout:20000});
  const hash=await seed.getByTestId('seed-hash').innerText();
  await receiver.getByLabel('Torrent info hash').fill(hash);
  await expect(receiver.getByRole('button',{name:'Load peer metadata',exact:true})).toBeDisabled();
  await receiver.getByLabel('I consent to P2P IP exposure and upload bandwidth.').check();
  await receiver.getByRole('button',{name:'Load peer metadata',exact:true}).click();
  await expect(receiver.getByLabel('Torrent file')).toBeVisible({timeout:20000});
  await expect(receiver.getByLabel('Torrent file')).toHaveValue('');
  await expect(receiver.getByRole('button',{name:'Play selected file via P2P',exact:true})).toBeDisabled();
  await receiver.waitForTimeout(500);
  expect(JSON.parse(await receiver.getByTestId('peer-stats').textContent() as string).downloaded).toBe(0);
  const deniedBeforeSelection=await receiver.evaluate(async hash=>{const r=await fetch(`./webtorrent/${hash}/`,{headers:{Range:'bytes=0-0'}});await r.body?.cancel();return r.status;},hash);
  expect(deniedBeforeSelection).toBe(403);
  expect(await receiver.evaluate(()=>navigator.serviceWorker.controller?.scriptURL)).toBe('http://127.0.0.1:4173/nostr-torrent/sw.min.js');
  const rival=await receiveContext.newPage();
  await rival.goto('http://127.0.0.1:4173/nostr-torrent/');await rival.getByRole('button',{name:'Controlled P2P demo',exact:true}).click();
  await rival.getByLabel('WSS tracker').fill(trackerUrl);await rival.getByLabel('Torrent info hash').fill(hash);await rival.getByLabel('I consent to P2P IP exposure and upload bandwidth.').check();await rival.getByRole('button',{name:'Load peer metadata',exact:true}).click();
  await expect(rival.getByRole('status')).toContainText('Another tab owns P2P streaming');expect(await rival.evaluate(()=>window.__rtc.length)).toBe(0);await rival.close();
  await receiver.getByLabel('Torrent file').selectOption('0');
  await receiver.getByRole('button',{name:'Play selected file via P2P',exact:true}).click();
  const video=receiver.locator('video');
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime),{timeout:25000}).toBeGreaterThan(0.5);
  const early=JSON.parse(await receiver.getByTestId('peer-stats').textContent() as string);
  expect(early.downloaded).toBeGreaterThan(0);expect(early.verifiedPieces).toBeGreaterThan(0);expect(early.downloaded).toBeLessThan(early.length);expect(early.peerDownloaded).toBeGreaterThan(0);expect(early.peers).toBeGreaterThan(0);
  expect(await video.getAttribute('src')).toContain('/nostr-torrent/webtorrent/');
  // A noncooperating same-origin window (different client ID) cannot read the stream.
  const forgedPage=await receiveContext.newPage();
  await forgedPage.goto('http://127.0.0.1:4173/nostr-torrent/');
  const forgedStatus=await forgedPage.evaluate(async url=>{const r=await fetch(url);await r.body?.cancel();return r.status;},await video.evaluate((v:HTMLVideoElement)=>v.currentSrc));
  expect(forgedStatus).toBe(403);
  await forgedPage.close();
  await video.evaluate((v:HTMLVideoElement)=>{v.currentTime=90;});
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>!v.seeking&&v.currentTime>90.5),{timeout:25000}).toBe(true);
  const final=JSON.parse(await receiver.getByTestId('peer-stats').textContent() as string);
  const upload=JSON.parse(await seed.getByTestId('peer-stats').textContent() as string);expect(upload.peerUploaded).toBeGreaterThan(0);
  expect(networkMedia).toEqual([]);expect(unexpectedHttp).toEqual([]);expect(new Set(sockets)).toEqual(new Set([trackerUrl+'/']));expect(errors).toEqual([]);
  const rtc=await receiver.evaluate(async()=>{const out:{type:string;bytesReceived:number;bytesSent:number}[]=[];for(const pc of window.__rtc)if(pc.connectionState==='connected')(await pc.getStats()).forEach(r=>{if(r.type==='data-channel')out.push({type:r.type,bytesReceived:r.bytesReceived,bytesSent:r.bytesSent});});return out;});
  expect(rtc.some(r=>r.bytesReceived>0)).toBe(true);
  const playback=await video.evaluate((v:HTMLVideoElement)=>({currentTime:v.currentTime,decodedFrames:v.getVideoPlaybackQuality().totalVideoFrames,readyState:v.readyState,width:v.videoWidth,height:v.videoHeight}));
  expect(playback.decodedFrames).toBeGreaterThan(0);
  await receiver.getByText('Live WebRTC transfer evidence (bytes and verified pieces)',{exact:true}).click();
  await receiver.screenshot({path:info.outputPath('p2p-playing.png'),fullPage:true});
  expect(await receiver.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const evidence={browser:browser.version(),viewport:info.project.name,hash,trackerUrl,early,final,upload,rtc,playback,networkMedia,unexpectedHttp,errors};
  console.log(JSON.stringify({p2p:true,browser:browser.version(),early,final,upload,rtc,playback,networkMedia,errors}));
  await seed.getByRole('button',{name:'Stop P2P & clear session',exact:true}).click();
  await video.evaluate((v:HTMLVideoElement)=>{v.currentTime=115;});
  await expect(receiver.getByRole('status')).toContainText('Playback stalled for 20 seconds',{timeout:25000});
  await expect(video).not.toHaveAttribute('src');
  await expect(receiver.locator('.transport')).toHaveText('Active transport: none');
  for(const page of [seed,receiver])await expect.poll(()=>page.evaluate(()=>window.__rtc.every(pc=>pc.connectionState==='closed'))).toBe(true);
  await receiver.getByLabel('Torrent info hash').fill('f'.repeat(40));
  await receiver.getByLabel('I consent to P2P IP exposure and upload bandwidth.').check();
  const started=Date.now();
  await receiver.getByRole('button',{name:'Load peer metadata',exact:true}).click();
  await expect(receiver.getByRole('status')).toContainText('No playable peer metadata or seed readiness after 20 seconds',{timeout:25000});
  const zeroPeerMs=Date.now()-started;expect(zeroPeerMs).toBeGreaterThanOrEqual(19500);expect(zeroPeerMs).toBeLessThan(25000);
  await expect.poll(()=>receiver.evaluate(()=>window.__rtc.every(pc=>pc.connectionState==='closed'))).toBe(true);
  await receiver.getByRole('button',{name:'Load peer metadata',exact:true}).click();
  await receiver.getByRole('button',{name:'Stop P2P & clear session',exact:true}).click();
  await expect(receiver.getByRole('status')).toContainText('Stopped.');
  await receiver.waitForTimeout(500);
  await expect(receiver.locator('.transport')).toHaveText('Active transport: none');
  await expect(video).not.toHaveAttribute('src');
  expect(networkMedia).toEqual([]);expect(unexpectedHttp).toEqual([]);expect(new Set(sockets)).toEqual(new Set([trackerUrl+'/']));expect(errors).toEqual([]);
  await expect.poll(()=>receiver.evaluate(()=>window.__rtc.every(pc=>pc.connectionState==='closed'))).toBe(true);
  const termination={zeroPeerMs,allPeerConnectionsClosed:true,noHttpMediaFallback:true};
  await writeFile(info.outputPath('p2p-evidence.json'),JSON.stringify({...evidence,...termination},null,2));
  await info.attach('p2p-evidence.json',{path:info.outputPath('p2p-evidence.json'),contentType:'application/json'});
  console.log(JSON.stringify(termination));
 } finally {await receiveContext.close();await seedContext.close();await fixture.close();}
});
