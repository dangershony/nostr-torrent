import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
// Same assertion runs red on the original UI and green after the fix; no mocked media.
const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try {
 const page = await browser.newPage();
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>errors.push(`${r.url()}: ${r.failure()?.errorText}`));
 page.on('response',r=>{if(r.url().includes('.mp4'))requests.push({url:r.url(),status:r.status()});});
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5173');
 await page.locator('#card-sintel').click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:/^(Load selected source|Play via HTTP)$/}).click();
 await page.waitForTimeout(12000);
 const read=()=>page.locator('video').evaluate(v=>({src:v.currentSrc,paused:v.paused,currentTime:v.currentTime,readyState:v.readyState,error:v.error?.message,width:v.videoWidth,height:v.videoHeight,mp4:v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')}));
 const afterLoad=await read();
 console.log(JSON.stringify({afterLoad,status:await page.getByRole('status').innerText(),requests,errors},null,2));
 // A real user gesture to distinguish autoplay omission from network/codec failure.
 await page.evaluate(()=>{const b=document.createElement('button');b.textContent='Diagnostic play';b.onclick=()=>document.querySelector('video').play().catch(e=>console.error(e));document.body.append(b);});
 await page.getByRole('button',{name:'Diagnostic play'}).click();
 await page.waitForTimeout(2500);
 console.log('After explicit native play:',JSON.stringify(await read()));
 assert.ok(afterLoad.currentTime>0 && !afterLoad.paused,'Consent + primary action must visibly start playback, not leave time at zero');
} finally {await browser.close();}
