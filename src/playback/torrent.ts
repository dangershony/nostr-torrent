import { selectedFileBridge } from './stream-bridge';
import { BoundedStore, MAX_STORE_BYTES } from './bounded-store';
import type WebTorrent from 'webtorrent/dist/webtorrent.min.js';
import type { Torrent } from 'webtorrent/dist/webtorrent.min.js';

export const MAX_TORRENT_BYTES=MAX_STORE_BYTES;
export const DEADLINE_MS=20000;
/** maxConns governs TCP queues upstream, not already connected browser peers. */
export function limitPeerWires(wires:{type:string;destroy:()=>void}[]) {
 for(const wire of wires.filter(w=>w.type==='webrtc').slice(4))wire.destroy();
}
export interface PeerStats { peers:number;downloaded:number;uploaded:number;peerDownloaded:number;peerUploaded:number;verifiedPieces:number;length:number; }
export interface PeerView {phase:'idle'|'connecting'|'metadata'|'seeding'|'playing'|'error';message:string;hash?:string;files?:{name:string;length:number;type:string}[];stats:PeerStats;}
export const emptyStats=():PeerStats=>({peers:0,downloaded:0,uploaded:0,peerDownloaded:0,peerUploaded:0,verifiedPieces:0,length:0});

/** One consented torrent, no URLs/magnets/web seeds and no background reconnect after stop. */
export function openPeerSession(options:{infoHash?:string;tracker:string;file?:File;consent:boolean;signal?:AbortSignal;media:HTMLVideoElement;update:(view:PeerView)=>void}) {
 const {media,update}=options;
 let active=true,client:WebTorrent|undefined,torrent:Torrent|undefined,releaseLock:(()=>void)|undefined;
 let view:PeerView={phase:'connecting',message:'Connecting to the chosen tracker and WebRTC peers…',stats:emptyStats()};
 let deadline:ReturnType<typeof setTimeout>|undefined,interval:ReturnType<typeof setInterval>|undefined,lifetime:ReturnType<typeof setTimeout>|undefined,stallTimer:ReturnType<typeof setTimeout>|undefined;
 let workerWait:ReturnType<typeof setTimeout>|undefined,wakeWorker:(()=>void)|undefined;
 let lastTime=0;
 let worker:ServiceWorker|undefined,bridge:ReturnType<typeof selectedFileBridge>|undefined;
 const resumed=()=>{clearTimeout(stallTimer);stallTimer=undefined;};
 const stalled=()=>{if(active&&!media.paused&&!media.ended&&stallTimer===undefined){lastTime=media.currentTime;stallTimer=setTimeout(()=>fail(Error('Playback stalled for 20 seconds. Peers stopped.')),DEADLINE_MS);}};
 const progressed=()=>{if(!media.seeking&&media.readyState>=media.HAVE_FUTURE_DATA&&media.currentTime>lastTime)resumed();lastTime=media.currentTime;};
 const publish=(patch:Partial<PeerView>)=>{if(active){view={...view,...patch};update(view);}};
 const stop=()=>{
  if(!active)return;active=false;options.signal?.removeEventListener('abort',stop);clearTimeout(deadline);clearTimeout(lifetime);clearInterval(interval);clearTimeout(workerWait);wakeWorker?.();wakeWorker=undefined;resumed();
  media.removeEventListener('waiting',stalled);media.removeEventListener('stalled',stalled);media.removeEventListener('playing',resumed);media.removeEventListener('pause',resumed);media.removeEventListener('timeupdate',progressed);
  media.removeEventListener('loadeddata',loaded);media.removeEventListener('error',decodeError);
  bridge?.stop();bridge=undefined;
  media.pause();media.removeAttribute('src');media.load();
  if(client&&!client.destroyed)client.destroy(()=>releaseLock?.());else releaseLock?.();
  update({phase:'idle',message:'Stopped. Peers disconnected; session store cleanup requested.',stats:emptyStats()});
 };
 const fail=(error:unknown)=>{if(!active)return;stop();update({phase:'error',message:`${error instanceof Error?error.message:'P2P failed.'} No HTTP fallback was loaded. Retry explicitly.`,stats:emptyStats()});};
 const arm=(message:string)=>{clearTimeout(deadline);deadline=setTimeout(()=>fail(Error(message)),DEADLINE_MS);};
 const loaded=()=>{clearTimeout(deadline);publish({phase:'playing',message:'Ready via P2P. Use the player controls to play, pause or seek.'});};
 const decodeError=()=>fail(Error('This MP4 could not load or decode. Choose a browser-compatible H.264 MP4.'));
 const sample=()=>{
  if(!torrent||torrent.destroyed)return;
  const wires=torrent.wires.filter(w=>w.type==='webrtc');
  publish({stats:{peers:wires.length,downloaded:torrent.downloaded,uploaded:torrent.uploaded,length:torrent.length||0,verifiedPieces:torrent.pieces?.reduce<number>((n,_,i)=>n+(torrent!.bitfield?.get(i)?1:0),0)||0,peerDownloaded:wires.reduce((n,w)=>n+w.downloaded,0),peerUploaded:wires.reduce((n,w)=>n+w.uploaded,0)}});
 };
 const checkMetadata=(t:Torrent)=>{
  if(!t.files.some(f=>f.type==='video/mp4'&&f.length>0)){fail(Error('This torrent contains no supported MP4. Choose a browser-compatible MP4 torrent.'));return false;}
  if(t.length>MAX_TORRENT_BYTES||t.files.length>100||t.pieces.length>4096||t.pieceLength>4*1024*1024){fail(Error('Torrent exceeds the 64 MiB / 100 files / 4096 pieces resource limit.'));return false;}return true;
 };
 const start=async()=>{
  if(!options.consent)throw Error('Explicit P2P consent is required.');
  const input=validatePeerInput(options.file?'0'.repeat(40):options.infoHash||'',options.tracker);
  if(options.file&&(!options.file.name.toLowerCase().endsWith('.mp4')||options.file.size===0||options.file.size>MAX_TORRENT_BYTES))throw Error('Choose a nonempty authorized MP4 no larger than 64 MiB.');
  if(!('serviceWorker' in navigator)||!navigator.locks)throw Error('This browser needs secure service workers and Web Locks for safe P2P streaming.');
  if(!options.file){
   await new Promise<void>((resolve,reject)=>{void navigator.locks.request(`nostr-torrent:${import.meta.env.BASE_URL}:stream`,{ifAvailable:true},async lock=>{if(!lock){reject(Error('Another tab owns P2P streaming. Stop that receiver first.'));return;}await new Promise<void>(release=>{releaseLock=release;resolve();});}).catch(reject);});
   if(!active){releaseLock?.();return;}
  }
  const {default:Engine}=await import('webtorrent/dist/webtorrent.min.js');
  if(!active)return;
  client=new Engine({webSeeds:false,dht:false,lsd:false,utPex:false,maxConns:4,uploadLimit:512*1024,downloadLimit:1024*1024,tracker:{rtcConfig:{iceServers:[]}}});
  client.on('error',fail);
  const opts={store:BoundedStore,announce:[input.tracker],urlList:[],destroyStoreOnDestroy:true,storeCacheSlots:0,deselect:true,strategy:'sequential'};
  if(options.file){
   torrent=client.seed(options.file,{...opts,pieceLength:65536},t=>{if(!active)return;clearTimeout(deadline);publish({phase:'seeding',hash:t.infoHash,message:'Seeding your chosen file. Keep this tab open; share only this hash and tracker with the receiver.'});sample();});
  }else{
   const registration=await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.min.js`,{scope:import.meta.env.BASE_URL});
   while(active&&(!registration.active||navigator.serviceWorker.controller?.scriptURL!==new URL(`${import.meta.env.BASE_URL}sw.min.js`,location.href).href))await new Promise<void>(resolve=>{wakeWorker=resolve;workerWait=setTimeout(()=>{workerWait=undefined;wakeWorker=undefined;resolve();},100);});
   if(!active)return;
   worker=registration.active!;
   torrent=client.add(input.infoHash,opts,t=>{if(!active||!checkMetadata(t))return;clearTimeout(deadline);publish({phase:'metadata',message:'Peer metadata received. Choose a file explicitly; no media file is selected yet.',files:t.files.map(f=>({name:f.name,length:f.length,type:f.type}))});sample();});
  }
  torrent.on('metadata',()=>{if(torrent)checkMetadata(torrent);});
  torrent.on('wire',()=>{if(torrent)limitPeerWires(torrent.wires);});
  torrent.on('error',fail);
  interval=setInterval(sample,250);
 };
 update(view);arm('No playable peer metadata or seed readiness after 20 seconds.');
 lifetime=setTimeout(()=>fail(Error('The 30-minute sharing session expired.')),30*60*1000);
 options.signal?.addEventListener('abort',stop,{once:true});
 if(options.signal?.aborted)stop();else void start().catch(fail);
 return {stop,play(index:number){
  if(!active||!torrent||view.phase!=='metadata')return;
  const file=torrent.files[index];
  if(!file||file.type!=='video/mp4'||!media.canPlayType(file.type)){fail(Error('Choose a browser-compatible MP4 file.'));return;}
  media.addEventListener('loadeddata',loaded,{once:true});media.addEventListener('error',decodeError);
  media.addEventListener('waiting',stalled);media.addEventListener('stalled',stalled);media.addEventListener('playing',resumed);media.addEventListener('pause',resumed);media.addEventListener('timeupdate',progressed);
  arm('No playable peer data after 20 seconds.');publish({phase:'connecting',message:'Loading the explicitly selected MP4 via P2P…'});
  try{
   if(!worker)throw Error('No active stream worker');
   bridge=selectedFileBridge(worker,file,import.meta.env.BASE_URL);
   void bridge.ready.then(url=>{if(!active)return;media.src=url;return media.play().catch(e=>{if(e?.name==='NotAllowedError')publish({message:'Press Play in the native controls to continue via P2P.'});else if(active)fail(e);});}).catch(e=>{if(active)fail(e);});
  }catch(e){fail(e);}
 }};
}

export function validatePeerInput(infoHash: string, tracker: string) {
 if (!/^[a-fA-F0-9]{40}$/.test(infoHash)) throw Error('Enter a bare 40-character v1 info hash, not a magnet or URL.');
 let url: URL;
 try { url = new URL(tracker); } catch { throw Error('Enter a valid wss:// tracker.'); }
 if (!/^wss:\/\//.test(tracker) || tracker.length>2048 || /[\s\\?#]/.test(tracker) || url.protocol !== 'wss:' || !url.hostname || url.username || url.password || url.hash || url.search) throw Error('Choose one wss:// tracker without credentials, query or fragment.');
 return {infoHash, tracker:url.href};
}
