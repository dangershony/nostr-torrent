import type { Video } from '../catalogue/model';
import { KINDS, parseEvent, safeUrl } from '../catalogue/parser';
export type Socket = Pick<WebSocket, 'readyState'|'onopen'|'onmessage'|'onerror'|'onclose'|'send'|'close'>;
/** One finite read, never a background subscription. Call returned disposer on navigation. */
export function readRelays(urls:string[],receive:(v:Video)=>void,status:(s:string)=>void,factory:(url:string)=>Socket=url=>new WebSocket(url)):()=>void {
 const seen=new Set<string>(),stops:Array<()=>void>=[];
 const selected=[...new Set(urls.map(u=>safeUrl(u,'wss:')).filter((u):u is string=>!!u))].slice(0,3);
 if(!selected.length)status('Enter a valid public wss:// relay URL.');
 for(const url of selected){
  let socket:Socket;try{socket=factory(url)}catch{status('Relay connection failed. Retry with another relay.');continue;}
  const id=crypto.randomUUID();let done=false,count=0;
  const finish=(message:string)=>{if(done)return;done=true;clearTimeout(timer);socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null;try{if(socket.readyState===1)socket.send(JSON.stringify(['CLOSE',id]));}catch{/* transport already lost */}try{socket.close()}catch{/* already closed */}status(message);};
  const timer=setTimeout(()=>finish('Relay read timed out after 10 seconds. Retry available.'),10000);
  stops.push(()=>finish('Relay read stopped.'));
  socket.onopen=()=>{try{socket.send(JSON.stringify(['REQ',id,{kinds:KINDS,limit:50}]))}catch{finish('Relay request failed.')}};
  socket.onerror=()=>finish('Relay connection failed. Retry available.');socket.onclose=()=>finish('Relay disconnected.');
  socket.onmessage=({data})=>{
   if(done)return;
   if(++count>200||typeof data!=='string'||data.length>65536||new TextEncoder().encode(data).length>65536){finish('Relay exceeded safety bounds.');return;}
   let msg:unknown;try{msg=JSON.parse(data)}catch{return;}
   if(!Array.isArray(msg)||msg[1]!==id)return;
   if(msg[0]==='EOSE'||msg[0]==='CLOSED'){finish('Relay read complete.');return;}
   if(msg[0]!=='EVENT')return;
   const video=parseEvent(msg[2]);if(!video||seen.has(video.id))return;
   seen.add(video.id);receive(video);if(seen.size>=100)stops.forEach(stop=>stop());
  };
 }
 return ()=>stops.forEach(stop=>stop());
}
