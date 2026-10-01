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
 start(source:Source,consent:boolean){
  this.stop();if(!consent){this.update({phase:'error',transport:'none',message:'Consent is required for this source.'});return;}
  const abort=new AbortController();let active=true,release:(()=>void)|undefined;
  let stallTimer:ReturnType<typeof setTimeout>|undefined;
  let lastTime=this.media.currentTime;
  const stall=()=>{if(!active||this.media.paused||this.media.ended||stallTimer!==undefined)return;lastTime=this.media.currentTime;stallTimer=setTimeout(()=>fail(Error('Playback stalled for 20 seconds. Stop completed; retry or choose another source.')),20000);};
  const resume=()=>{clearTimeout(stallTimer);stallTimer=undefined;};
  const timeupdate=()=>{if(this.media.currentTime>lastTime&&!this.media.seeking)resume();lastTime=this.media.currentTime;};
  // Network progress alone is not recovery: data must cover future playback.
  const progress=()=>{if(this.media.readyState>=this.media.HAVE_FUTURE_DATA)resume();};
  this.media.addEventListener('progress',progress);
  this.media.addEventListener('timeupdate',timeupdate);
  this.media.addEventListener('playing',resume);
  this.media.addEventListener('pause',resume);this.media.addEventListener('ended',resume);
  this.media.addEventListener('waiting',stall);this.media.addEventListener('stalled',stall);
  const cleanup=()=>{if(!active)return;active=false;clearTimeout(timer);resume();this.media.removeEventListener('progress',progress);this.media.removeEventListener('timeupdate',timeupdate);this.media.removeEventListener('waiting',stall);this.media.removeEventListener('stalled',stall);this.media.removeEventListener('playing',resume);this.media.removeEventListener('pause',resume);this.media.removeEventListener('ended',resume);abort.abort();release?.();};
  const fail=(error:Error)=>{if(!active)return;cleanup();this.update({phase:'error',transport:'none',message:error.message});};
  const timer=setTimeout(()=>fail(Error('No playable data after 20 seconds. Stop completed; retry or choose another source.')),20000);
  this.dispose=cleanup;
  this.update({phase:'connecting',transport:'none',message:`Connecting via ${source.type==='p2p'?'P2P':'HTTP'}…`});
  try{
   release=this.adapters[source.type].open(this.media,source,abort.signal,()=>{if(!active)return;clearTimeout(timer);this.update({phase:'ready',transport:source.type,message:'Ready. Use the player controls to play or seek.'});},fail);
   if(!active)release();
  }catch(e){fail(e instanceof Error?e:Error('Playback failed. Retry available.'));}
 }
 stop(){this.dispose?.();this.dispose=undefined;this.update({phase:'idle',transport:'none',message:'Stopped. No active transport.'});}
}
