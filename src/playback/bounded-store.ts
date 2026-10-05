export const MAX_STORE_BYTES=64*1024*1024;
type Callback=(error:Error|null,data?:Uint8Array)=>void;
/** Volatile, explicitly bounded piece storage. No OPFS persistence or unbounded fallback. */
export class BoundedStore {
 private chunks=new Map<number,Uint8Array>();
 private closed=false;
 bytes=0;
 constructor(private pieceLength:number,private options:{length:number}){}
 put(index:number,data:Uint8Array,cb:Callback){
  const length=this.options.length;
  const valid=!this.closed&&Number.isSafeInteger(length)&&length>0&&length<=MAX_STORE_BYTES&&Number.isSafeInteger(index)&&index>=0&&index<Math.ceil(length/this.pieceLength)&&this.pieceLength>0&&this.pieceLength<=4*1024*1024&&data.length===Math.min(this.pieceLength,length-index*this.pieceLength);
  const next=this.bytes-(this.chunks.get(index)?.length||0)+data.length;
  if(!valid||next>MAX_STORE_BYTES){queueMicrotask(()=>cb(Error('Piece store resource limit or closed session.')));return;}
  this.chunks.set(index,data.slice());this.bytes=next;queueMicrotask(()=>cb(null));
 }
 get(index:number,options:{offset?:number;length?:number}|Callback,callback?:Callback){
  const cb=typeof options==='function'?options:callback!;
  const opts=typeof options==='function'?{}:options;
  const data=this.closed?undefined:this.chunks.get(index);
  queueMicrotask(()=>{if(!data||this.closed)cb(Error('Piece unavailable.'));else{const start=opts.offset||0;cb(null,data.slice(start,opts.length===undefined?undefined:start+opts.length));}});
 }
 close(cb:()=>void){this.closed=true;this.chunks.clear();this.bytes=0;queueMicrotask(cb);}
 destroy(cb:()=>void){this.close(cb);}
}
