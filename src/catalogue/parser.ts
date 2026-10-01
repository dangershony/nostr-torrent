import { verifyEvent, type Event } from 'nostr-tools';
import type { Video, Source } from './model';
export const KINDS = [21,22,34235,34236,2003];
export function safeUrl(value:unknown,protocol='https:'):string|undefined {
 if(typeof value!=='string'||value.length>2048)return;
 try{const u=new URL(value);const h=u.hostname.toLowerCase().replace(/\.+$/, ''); // Lexical guard only; DNS and redirects are not checked.
 if(u.protocol!==protocol||u.username||u.password||!h.includes('.')||h.endsWith('.local')||h.endsWith('.localhost')||/^[\d.]+$/.test(h)||h.includes(':'))return;return u.href;}catch{return;}
}
export function parseEvent(input:unknown):Video|null {
 try {
  if(!input||typeof input!=='object')return null;
  // Copy only wire fields: never trust a caller-supplied cached verification symbol.
  const x=input as Event;
  if(typeof x.content!=='string'||x.content.length>16000||!Array.isArray(x.tags)||x.tags.length>128||!KINDS.includes(x.kind)||!Number.isSafeInteger(x.created_at)||x.created_at<0)return null;
  if(!x.tags.every(t=>Array.isArray(t)&&t.length>0&&t.length<=32&&t.every(v=>typeof v==='string'&&v.length<=2048)))return null;
  if(!/^[a-f0-9]{64}$/.test(x.id)||!/^[a-f0-9]{64}$/.test(x.pubkey)||!/^[a-f0-9]{128}$/.test(x.sig))return null;
  const e:Event={id:x.id,pubkey:x.pubkey,sig:x.sig,created_at:x.created_at,kind:x.kind,content:x.content,tags:x.tags};
  if(JSON.stringify(e).length>65536||!verifyEvent(e))return null;
  const tag=(key:string)=>e.tags.find(t=>t[0]===key)?.[1];
  if((e.kind===34235||e.kind===34236)&&!tag('d'))return null;
  const title=tag('title')?.trim();if(!title)return null;
  const sources:Source[]=[];let duration:number|undefined;
  if(e.kind===2003){
   const hash=tag('x');if(!hash||!/^[a-fA-F0-9]{40}$/.test(hash)||!e.tags.some(t=>t[0]==='file'&&/\.(mp4|webm|m4v|mov|mkv)$/i.test(t[1]??'')))return null;
   sources.push({type:'p2p',infoHash:hash.toLowerCase(),trackers:[...new Set(e.tags.filter(t=>t[0]==='tracker').map(t=>safeUrl(t[1],'wss:')).filter((u):u is string=>!!u))].slice(0,5)});
  }else{
   for(const t of e.tags.filter(t=>t[0]==='imeta').slice(0,8)){
    const fields=t.slice(1).map(s=>{const i=s.indexOf(' ');return [s.slice(0,i),s.slice(i+1)]});
    const get=(key:string)=>fields.find(f=>f[0]===key)?.[1];const url=safeUrl(get('url')),mime=get('m');
    if(!url||!mime?.startsWith('video/'))continue;
    const sha=get('x');sources.push({type:'http',url,mime,sha256:sha&&/^[a-f0-9]{64}$/.test(sha)?sha:undefined});
    const seconds=Number(get('duration'));if(Number.isFinite(seconds)&&seconds>0&&seconds<604800)duration=seconds;
   }
  }
  return {id:e.id,title:title.slice(0,160),description:e.content,creator:e.pubkey,category:(tag('t')||'Film').slice(0,40),sources,origin:'relay',duration,warning:tag('content-warning')};
 }catch{return null;}
}
