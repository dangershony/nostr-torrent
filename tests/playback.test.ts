import { it, expect, vi, afterEach } from 'vitest';
import { Playback, httpAdapter, unavailablePeerAdapter, type Adapter } from '../src/playback/playback';
import type { Source } from '../src/catalogue/model';
const http:Source={type:'http',url:'https://media.example/a.mp4',mime:'video/mp4'};
const peer:Source={type:'p2p',infoHash:'a'.repeat(40),trackers:[]};
afterEach(()=>vi.useRealTimers());
it.each([['pause','Paused'],['ended','Finished']])('reports %s without claiming playback continues', (event,message)=>{
 const media=document.createElement('video');const adapter:Adapter={open:(_m,_s,_signal,ready)=>{ready();return vi.fn()}};const state=vi.fn();const p=new Playback(media,{http:adapter,p2p:adapter},state);
 p.start(http,true);media.dispatchEvent(new Event('playing'));media.dispatchEvent(new Event(event));
 expect(state.mock.lastCall?.[0]).toMatchObject({phase:'ready',transport:'http',message:expect.stringContaining(message)});p.stop();
});
it('keeps a loaded source usable with native controls when the browser blocks play',async()=>{
 const media=document.createElement('video');media.load=vi.fn();media.pause=vi.fn();media.canPlayType=vi.fn(()=>'probably' as const);media.play=vi.fn().mockRejectedValue(new DOMException('Gesture required','NotAllowedError'));
 const state=vi.fn();const p=new Playback(media,{http:httpAdapter,p2p:unavailablePeerAdapter},state);
 p.start(http,true,true);await Promise.resolve();media.dispatchEvent(new Event('loadeddata'));
 expect(media.src).toBe(http.url);expect(state.mock.lastCall?.[0]).toMatchObject({phase:'ready',transport:'http',message:expect.stringMatching(/browser.*blocked.*native.*Play/i)});p.stop();
});
it('ignores a stale play rejection after stopping or switching sources',async()=>{
 const media=document.createElement('video');let reject!:(error:Error)=>void;media.play=vi.fn(()=>new Promise<void>((_resolve,r)=>{reject=r}));const release=vi.fn();const adapter:Adapter={open:(_m,_s,_signal,ready)=>{ready();return release}};const state=vi.fn();const p=new Playback(media,{http:adapter,p2p:adapter},state);
 p.start(http,true,true);p.stop();state.mockClear();reject(Error('aborted'));await Promise.resolve();expect(state).not.toHaveBeenCalled();expect(release).toHaveBeenCalledOnce();
});
it.each([false,true])('keeps buffered playback alive after stalled without another playing event (progress events: %s)',withProgress=>{
 vi.useFakeTimers();const media=document.createElement('video');Object.defineProperty(media,'readyState',{value:3,configurable:true});Object.defineProperty(media,'paused',{value:false,configurable:true});
 const release=vi.fn();const adapter:Adapter={open:(_m,_s,_signal,ready)=>{ready();return release}};const state=vi.fn();const player=new Playback(media,{http:adapter,p2p:adapter},state);
 player.start(http,true);media.dispatchEvent(new Event('stalled'));
 for(let second=1;second<=25;second++){vi.advanceTimersByTime(1000);media.currentTime=second;media.dispatchEvent(new Event('timeupdate'));if(withProgress)media.dispatchEvent(new Event('progress'));}
 expect(state.mock.lastCall?.[0].phase).toBe('ready');expect(release).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);player.stop();
});
it.each([0,1,2,3,4])('only recovered future media data cancels a download stall (readyState %i)',readyState=>{
 vi.useFakeTimers();const media=document.createElement('video');Object.defineProperty(media,'readyState',{value:2,configurable:true});Object.defineProperty(media,'paused',{value:false,configurable:true});
 const release=vi.fn();const adapter:Adapter={open:(_m,_s,_signal,ready)=>{ready();return release}};const state=vi.fn();const player=new Playback(media,{http:adapter,p2p:adapter},state);
 player.start(http,true);media.dispatchEvent(new Event('waiting'));vi.advanceTimersByTime(19000);
 Object.defineProperty(media,'readyState',{value:readyState});media.dispatchEvent(new Event('progress'));media.dispatchEvent(new Event('timeupdate'));vi.advanceTimersByTime(1000);
 expect(state.mock.lastCall?.[0].phase).toBe(readyState>=3?'ready':'error');expect(release).toHaveBeenCalledTimes(readyState>=3?0:1);expect(vi.getTimerCount()).toBe(0);player.stop();
});
it.each(['pause','ended'])('cancels a pending stall on %s',event=>{
 vi.useFakeTimers();const media=document.createElement('video');Object.defineProperty(media,'paused',{value:false,configurable:true});
 const release=vi.fn();const adapter:Adapter={open:(_m,_s,_signal,ready)=>{ready();return release}};const state=vi.fn();const player=new Playback(media,{http:adapter,p2p:adapter},state);
 player.start(http,true);media.dispatchEvent(new Event('waiting'));vi.advanceTimersByTime(19000);
 Object.defineProperty(media,event==='pause'?'paused':'ended',{value:true,configurable:true});media.dispatchEvent(new Event(event));
 expect(vi.getTimerCount()).toBe(0);media.dispatchEvent(new Event('stalled'));vi.advanceTimersByTime(21000);
 expect(state.mock.lastCall?.[0].phase).toBe('ready');expect(release).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);player.stop();
});
it.each(['waiting','stalled'])('bounds %s after initial data without extending the deadline on repeated stalls',event=>{
 vi.useFakeTimers();const media=document.createElement('video');Object.defineProperty(media,'paused',{value:false,configurable:true});media.load=vi.fn();media.pause=vi.fn();media.canPlayType=vi.fn(()=>'probably' as const);
 const state=vi.fn();const player=new Playback(media,{http:httpAdapter,p2p:unavailablePeerAdapter},state);
 player.start(http,true);media.dispatchEvent(new Event('loadeddata'));media.dispatchEvent(new Event(event));
 vi.advanceTimersByTime(19000);media.dispatchEvent(new Event(event));vi.advanceTimersByTime(1000);
 expect(state.mock.lastCall?.[0]).toMatchObject({phase:'error',transport:'none',message:expect.stringMatching(/stall.*retry/i)});
 expect(media.hasAttribute('src')).toBe(false);expect(media.pause).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
});
it('cancels a stall deadline on playing and gives a later stall its own deadline',()=>{
 vi.useFakeTimers();const media=document.createElement('video');Object.defineProperty(media,'paused',{value:false,configurable:true});let ready=()=>{};const adapter:Adapter={open:(_m,_s,_signal,r)=>{ready=r;return vi.fn()}};
 const state=vi.fn();const player=new Playback(media,{http:adapter,p2p:adapter},state);
 player.start(http,true);ready();media.dispatchEvent(new Event('waiting'));vi.advanceTimersByTime(19000);media.dispatchEvent(new Event('playing'));
 expect(vi.getTimerCount()).toBe(0);vi.advanceTimersByTime(21000);expect(state.mock.lastCall?.[0].phase).toBe('ready');
 media.dispatchEvent(new Event('stalled'));vi.advanceTimersByTime(19999);expect(state.mock.lastCall?.[0].phase).toBe('ready');vi.advanceTimersByTime(1);expect(state.mock.lastCall?.[0].phase).toBe('error');
});
it.each(['stop','source change'])('removes stall timers and listeners on %s',action=>{
 vi.useFakeTimers();const media=document.createElement('video');Object.defineProperty(media,'paused',{value:false,configurable:true});const add=vi.spyOn(media,'addEventListener'),remove=vi.spyOn(media,'removeEventListener');let ready=()=>{};const release=vi.fn();const adapter:Adapter={open:(_m,_s,_signal,r)=>{ready=r;return release}};
 const state=vi.fn();const player=new Playback(media,{http:adapter,p2p:adapter},state);
 player.start(http,true);ready();media.dispatchEvent(new Event('waiting'));const listeners=[...add.mock.calls];
 if(action==='stop')player.stop();else{player.start(peer,true);ready();}
 expect(vi.getTimerCount()).toBe(0);expect(release).toHaveBeenCalledOnce();
 for(const [name,handler] of listeners)expect(remove).toHaveBeenCalledWith(name,handler);
 vi.advanceTimersByTime(20000);expect(state.mock.lastCall?.[0].phase).toBe(action==='stop'?'idle':'ready');player.stop();
});
it('requires transport-specific consent and never implicitly falls back',()=>{
 const h={open:vi.fn(()=>vi.fn())},p={open:vi.fn(()=>{throw Error('No peers')})};const state=vi.fn(),player=new Playback(document.createElement('video'),{http:h,p2p:p},state);
 player.start(http,false);expect(h.open).not.toHaveBeenCalled();player.start(peer,true);expect(h.open).not.toHaveBeenCalled();expect(state.mock.lastCall?.[0]).toMatchObject({phase:'error',transport:'none'});
});
it('times out, cleans up, retries and cancels without stale callbacks',()=>{
 vi.useFakeTimers();const dispose=vi.fn();let ready=()=>{};const adapter:Adapter={open:(_m,_s,_signal,r)=>{ready=r;return dispose}};const state=vi.fn();const p=new Playback(document.createElement('video'),{http:adapter,p2p:adapter},state);
 p.start(peer,true);vi.advanceTimersByTime(20000);expect(dispose).toHaveBeenCalledOnce();expect(state.mock.lastCall?.[0].phase).toBe('error');ready();expect(state.mock.lastCall?.[0].phase).toBe('error');p.start(peer,true);ready();expect(state.mock.lastCall?.[0].transport).toBe('p2p');p.stop();expect(dispose).toHaveBeenCalledTimes(2);expect(vi.getTimerCount()).toBe(0);
});
it('HTTP sets no source until open, supports native controls, and removes it on error/stop',()=>{
 const media=document.createElement('video');media.load=vi.fn();media.pause=vi.fn();media.canPlayType=vi.fn(()=>'probably' as const);const state=vi.fn();const p=new Playback(media,{http:httpAdapter,p2p:unavailablePeerAdapter},state);
 expect(media.hasAttribute('src')).toBe(false);p.start(http,true);expect(media.src).toBe(http.url);media.dispatchEvent(new Event('loadeddata'));expect(state.mock.lastCall?.[0].transport).toBe('http');media.dispatchEvent(new Event('error'));expect(media.hasAttribute('src')).toBe(false);expect(media.pause).toHaveBeenCalled();expect(state.mock.lastCall?.[0].phase).toBe('error');
});
it('rejects unsupported formats and peer engine absence without loading HTTP',()=>{
 const media=document.createElement('video');media.canPlayType=vi.fn(()=>'' as const);media.load=vi.fn();media.pause=vi.fn();const state=vi.fn();const p=new Playback(media,{http:httpAdapter,p2p:unavailablePeerAdapter},state);p.start(http,true);expect(media.hasAttribute('src')).toBe(false);expect(state.mock.lastCall?.[0].message).toMatch(/format/i);p.start(peer,true);expect(state.mock.lastCall?.[0].message).toMatch(/WebTorrent/);
});
it('releases media resources exactly once and aborts a pending request on stop',()=>{
 const media=document.createElement('video');media.canPlayType=vi.fn(()=>'probably' as const);media.pause=vi.fn();media.load=vi.fn();
 const p=new Playback(media,{http:httpAdapter,p2p:unavailablePeerAdapter},()=>{});p.start(http,true);p.stop();p.stop();expect(media.pause).toHaveBeenCalledTimes(1);expect(media.hasAttribute('src')).toBe(false);
});
