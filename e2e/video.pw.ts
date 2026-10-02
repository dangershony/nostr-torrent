import { test, expect } from '@playwright/test';

test('real HTTP demo plays, seeks and clears only after consent',async({page},info)=>{
 const mediaRequests:string[]=[],responses:{url:string;status:number}[]=[],errors:string[]=[];
 page.on('request',r=>{if(r.resourceType()==='media')mediaRequests.push(r.url());});
 page.on('response',r=>{if(r.request().resourceType()==='media')responses.push({url:r.url(),status:r.status()});});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');await page.locator('#card-sintel').click();
 const video=page.locator('video'),play=page.getByRole('button',{name:'Play via HTTP',exact:true});
 await expect(play).toBeDisabled();expect(await video.getAttribute('src')).toBeNull();expect(mediaRequests).toEqual([]);
 await page.getByRole('checkbox').check();expect(mediaRequests).toEqual([]);
 await play.click();
 await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime),{timeout:30000}).toBeGreaterThan(1);
 const before=await video.evaluate((v:HTMLVideoElement)=>v.currentTime);
 await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(before+0.5);
 await expect(page.locator('.transport')).toHaveText('Active transport: HTTP');
 await expect(video).toBeInViewport({ratio:0.9});
 await video.evaluate((v:HTMLVideoElement)=>{v.currentTime=20;});
 await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>!v.seeking&&v.currentTime>20.5)).toBe(true);
 const evidence=await video.evaluate((v:HTMLVideoElement)=>({currentTime:v.currentTime,paused:v.paused,readyState:v.readyState,width:v.videoWidth,height:v.videoHeight,duration:v.duration,src:v.currentSrc,decodedFrames:v.getVideoPlaybackQuality().totalVideoFrames}));
 expect(evidence.paused).toBe(false);expect(evidence.width).toBe(854);expect(evidence.height).toBe(480);expect(evidence.decodedFrames).toBeGreaterThan(0);
 await video.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('playing.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await video.evaluate((v:HTMLVideoElement)=>v.pause());const pausedTime=await video.evaluate((v:HTMLVideoElement)=>v.currentTime);await page.waitForTimeout(400);expect(await video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBe(pausedTime);
 await page.getByRole('button',{name:'Stop & clear session'}).click();await expect(video).not.toHaveAttribute('src');await expect(page.locator('.transport')).toHaveText('Active transport: none');
 await page.getByRole('button',{name:'Play via HTTP',exact:true}).click();await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime),{timeout:30000}).toBeGreaterThan(0.5);
 await page.getByRole('checkbox').uncheck();await expect(video).not.toHaveAttribute('src');await expect(play).toBeDisabled();
 await page.getByRole('button',{name:'Back to catalogue'}).click();await expect(video).toHaveCount(0);
 expect(errors).toEqual([]);expect(responses.some(r=>r.status===200||r.status===206)).toBe(true);
 console.log(JSON.stringify({viewport:info.project.name,browser:page.context().browser()?.version(),before,afterSeek:evidence,responses,pageErrors:errors}));
});

test('simulated unavailable HTTP host offers retry without a silent fallback',async({page})=>{
 const requests:string[]=[];
 await page.route('**/sintel_trailer-480p.mp4',route=>{requests.push(route.request().url());return route.fulfill({status:503,contentType:'text/plain',body:'Simulated unavailable host'});});
 await page.goto('./');await page.locator('#card-sintel').click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Play via HTTP',exact:true}).click();
 await expect(page.getByRole('status')).toContainText(/Retry/i);
 await expect(page.locator('.transport')).toHaveText('Active transport: none');await expect(page.locator('video')).not.toHaveAttribute('src');
 const attempts=requests.length;expect(attempts).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Retry & play via HTTP'}).click();await expect.poll(()=>requests.length).toBeGreaterThan(attempts);
 expect(new Set(requests).size).toBe(1);
});

test('catalogue distinguishes open demo from source-less fixtures',async({page})=>{
 await page.goto('./');await expect(page.locator('#card-sintel')).toContainText('HTTP demo');
 await expect(page.locator('#card-quiet-earth')).toContainText('No video attached');
 await page.locator('#card-quiet-earth').click();await expect(page.getByRole('heading',{name:'No playable source'})).toBeVisible();
 await expect(page.locator('.source-panel')).toContainText('Sintel');
 await expect(page.locator('video')).not.toHaveAttribute('src');await expect(page.getByRole('checkbox')).toHaveCount(0);
});
