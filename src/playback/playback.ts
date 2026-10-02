import type { Source } from '../catalogue/model';
import { safeUrl } from '../catalogue/parser';
export interface State { phase:'idle'|'connecting'|'ready'|'error'; transport:'none'|'http'|'p2p'; message:string; }
/** open must return cleanup immediately, and release partial resources itself if it throws. */
export interface Adapter {open(media:HTMLVideoElement,source:Source,signal:AbortSignal,ready:()=>void,error:(error:Error)=>void):()=>void;}
export const httpAdapter:Adapter={open(media,source,signal,ready,error){
 if(source.type!=='http'||!safeUrl(source.url))throw Error('This HTTP source is unavailable or unsafe.');
 if(!media.canPlayType(source.mime))throw Error('Unsupported media format. Choose another source or browser.');
 const fail=()=>error(Error('Media could not load or decode. Retry or explicitly choose another source.'));
 let cleaned=false;
 const cleanup=()=>{if(cleaned)return;cleaned=true;media.removeEventListener('loadeddata',ready);media.removeEventListener('error',fail);signal.removeEventListener('abort',cleanup);media.pause();media.removeAttribute('src');media.load();};
 media.addEventListener('loadeddata',ready,{once:true});media.addEventListener('error',fail);signal.addEventListener('abort',cleanup,{once:true});
 try{media.src=source.url;media.load();}catch(e){cleanup();throw e;}
 return ()=>{signal.removeEventListener('abort',cleanup);cleanup();};
}};
export const unavailablePeerAdapter:Adapter={open(){throw Error('Browser WebTorrent is unavailable in this build. A controlled WebRTC seed and browser engine must be verified first. No HTTP source was loaded.');}};
export class Playback {
 private dispose?:()=>void;
 constructor(private media:HTMLVideoElement,private adapters:Record<Source['type'],Adapter>,private update:(s:State)=>void){}
 start(source:Source,consent:boolean,play=false){
  this.stop();if(!consent){this.update({phase:'error',transport:'none',message:'Consent is required for this source.'});return;}
  const abort=new AbortController();let active=true,release:(()=>void)|undefined;
  let hasData=false,playBlocked=false;
  const blockedMessage='Your browser blocked playback. Use the native player controls and press Play to continue with this source.';
  let stallTimer:ReturnType<typeof setTimeout>|undefined;
  let lastTime=this.media.currentTime;
  const stall=()=>{if(!active||this.media.paused||this.media.ended||stallTimer!==undefined)return;lastTime=this.media.currentTime;stallTimer=setTimeout(()=>fail(Error('Playback stalled for 20 seconds. Stop completed; retry or choose another source.')),20000);};
  const resume=()=>{clearTimeout(stallTimer);stallTimer=undefined;};
  const playing=()=>{resume();if(!active)return;hasData=true;playBlocked=false;clearTimeout(timer);this.update({phase:'ready',transport:source.type,message:`Playing via ${source.type==='http'?'HTTP':'P2P'}. Use the player controls to pause or seek.`});};
  const paused=()=>{resume();if(active&&hasData)this.update({phase:'ready',transport:source.type,message:'Paused. Use the player controls to resume or seek.'});};
  const ended=()=>{resume();if(active&&hasData)this.update({phase:'ready',transport:source.type,message:'Finished. Replay this source or choose another film.'});};
  const timeupdate=()=>{if(this.media.currentTime>lastTime&&!this.media.seeking)resume();lastTime=this.media.currentTime;};
  // Network progress alone is not recovery: data must cover future playback.
  const progress=()=>{if(this.media.readyState>=this.media.HAVE_FUTURE_DATA)resume();};
  this.media.addEventListener('progress',progress);
  this.media.addEventListener('timeupdate',timeupdate);
  this.media.addEventListener('playing',playing);
  this.media.addEventListener('pause',paused);this.media.addEventListener('ended',ended);
  this.media.addEventListener('waiting',stall);this.media.addEventListener('stalled',stall);
  const cleanup=()=>{if(!active)return;active=false;clearTimeout(timer);resume();this.media.removeEventListener('progress',progress);this.media.removeEventListener('timeupdate',timeupdate);this.media.removeEventListener('waiting',stall);this.media.removeEventListener('stalled',stall);this.media.removeEventListener('playing',playing);this.media.removeEventListener('pause',paused);this.media.removeEventListener('ended',ended);abort.abort();release?.();};
  const fail=(error:Error)=>{if(!active)return;cleanup();this.update({phase:'error',transport:'none',message:error.message});};
  const timer=setTimeout(()=>fail(Error('No playable data after 20 seconds. Stop completed; retry or choose another source.')),20000);
  this.dispose=cleanup;
  this.update({phase:'connecting',transport:'none',message:`Connecting via ${source.type==='p2p'?'P2P':'HTTP'}…`});
  try{
   release=this.adapters[source.type].open(this.media,source,abort.signal,()=>{if(!active)return;hasData=true;clearTimeout(timer);this.update({phase:'ready',transport:source.type,message:playBlocked?blockedMessage:'Ready. Use the player controls to play or seek.'});},fail);
   if(!active)release();
   // Invoke during the original button gesture, not after an async loadeddata callback.
   else if(play)void this.media.play().catch(error=>{
    if(!active)return;
    if(error?.name==='NotAllowedError'){playBlocked=true;this.update({phase:hasData?'ready':'connecting',transport:hasData?source.type:'none',message:blockedMessage});}
    else fail(Error('Playback could not start. Retry the selected source or use another browser. No fallback was loaded.'));
   });
  }catch(e){fail(e instanceof Error?e:Error('Playback failed. Retry available.'));}
 }
 stop(){this.dispose?.();this.dispose=undefined;this.update({phase:'idle',transport:'none',message:'Stopped. No active transport.'});}
}
