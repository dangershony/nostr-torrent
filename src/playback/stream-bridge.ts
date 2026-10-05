import type { TorrentFile } from 'webtorrent/dist/webtorrent.min.js';

/** Private transferred port: only the exact registered worker can request bytes. */
export function selectedFileBridge(worker: ServiceWorker, file: TorrentFile, base: string) {
 const cap=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
 const channel=new MessageChannel(), port=channel.port1;
 const reads=new Map<number,{iterator:AsyncIterableIterator<Uint8Array>;busy:boolean;remaining:number}>();
 let active=true;
 let rejectReady:(e:Error)=>void=()=>{};
 const closeRead=(id:number)=>{const read=reads.get(id);if(read){reads.delete(id);void read.iterator.return?.().catch(()=>{});}};
 const stop=()=>{if(!active)return;active=false;clearTimeout(timer);for(const id of reads.keys())closeRead(id);port.postMessage({type:'revoke',cap});port.close();rejectReady(Error('Stream bridge stopped'));};
 const timer=setTimeout(stop,20000);
 const ready=new Promise<string>((resolve,reject)=>{
  rejectReady=reject;
  port.onmessage=async({data:m})=>{
   if(!active||!m||m.cap!==cap)return;
   if(m.type==='ready'&&typeof m.owner==='string'&&m.owner){clearTimeout(timer);resolve(new URL(`${base}webtorrent/${cap}`,location.origin).href);return;}
   if(!Number.isSafeInteger(m.id)||m.id<=0)return;
   if(m.type==='cancel'){closeRead(m.id);return;}
   if(m.type!=='pull'||!Number.isSafeInteger(m.start)||!Number.isSafeInteger(m.end)||m.start<0||m.end<m.start||m.end>=file.length)return;
   let read=reads.get(m.id);
   if(!read){if(reads.size>=8)return;read={iterator:file[Symbol.asyncIterator]({start:m.start,end:m.end}),busy:false,remaining:m.end-m.start+1};reads.set(m.id,read);}
   if(read.busy)return;read.busy=true;
   try{
    const result=await read.iterator.next();
    if(!active||reads.get(m.id)!==read)return;
    if(result.done||!result.value?.byteLength)throw Error('Unexpected EOF');
    // Upstream treats end=0 as no end; trim to the authorized range.
    const bytes=new Uint8Array(result.value.subarray(0,read.remaining));read.remaining-=bytes.length;
    port.postMessage({type:'chunk',cap,id:m.id,bytes},[bytes.buffer]);
    if(!read.remaining)closeRead(m.id);
   }catch{if(active)port.postMessage({type:'error',cap,id:m.id});closeRead(m.id);}
   finally{read.busy=false;}
  };
  port.onmessageerror=stop;
 });
 worker.postMessage({type:'bind',cap,length:file.length},[channel.port2]);
 return {ready,stop};
}
