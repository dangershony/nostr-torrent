import { expect, it, vi } from 'vitest';
import { openPeerSession, validatePeerInput, limitPeerWires } from '../src/playback/torrent';
it('closes established WebRTC wires beyond four instead of trusting the TCP-only maxConns setting',()=>{
 const wires=Array.from({length:6},()=>({type:'webrtc',destroy:vi.fn()}));
 limitPeerWires(wires);
 expect(wires.slice(0,4).every(w=>w.destroy.mock.calls.length===0)).toBe(true);
 expect(wires.slice(4).every(w=>w.destroy.mock.calls.length===1)).toBe(true);
});
it('refuses unconsented sharing before importing an engine and releases deadlines',async()=>{
 vi.useFakeTimers();
 try{
  const media=document.createElement('video');media.pause=vi.fn();media.load=vi.fn();const update=vi.fn();
  const session=openPeerSession({infoHash:'a'.repeat(40),tracker:'wss://tracker.example',consent:false,media,update});
  await Promise.resolve();await Promise.resolve();
  expect(update.mock.lastCall?.[0]).toMatchObject({phase:'error',message:expect.stringContaining('consent')});
  expect(media.hasAttribute('src')).toBe(false);expect(vi.getTimerCount()).toBe(0);
  session.stop();session.stop();expect(media.pause).toHaveBeenCalledOnce();
 }finally{vi.useRealTimers();}
});
it('honors an AbortSignal immediately and removes deadlines without late errors',async()=>{
 vi.useFakeTimers();
 try {
  const media=document.createElement('video');media.pause=vi.fn();media.load=vi.fn();const update=vi.fn();const abort=new AbortController();
  const session=openPeerSession({infoHash:'a'.repeat(40),tracker:'wss://tracker.example',consent:true,media,update,signal:abort.signal});
  abort.abort();await Promise.resolve();await Promise.resolve();
  expect(update.mock.lastCall?.[0]).toMatchObject({phase:'idle'});
  expect(vi.getTimerCount()).toBe(0);session.stop();expect(media.pause).toHaveBeenCalledOnce();
 }finally{vi.useRealTimers();}
});
it('does not begin setup for an already-aborted signal',async()=>{
 vi.useFakeTimers();
 try {
  const media=document.createElement('video');media.pause=vi.fn();media.load=vi.fn();const update=vi.fn();const abort=new AbortController();abort.abort();
  openPeerSession({infoHash:'a'.repeat(40),tracker:'wss://tracker.example',consent:true,media,update,signal:abort.signal});
  await Promise.resolve();await Promise.resolve();
  expect(update.mock.lastCall?.[0]).toMatchObject({phase:'idle'});expect(vi.getTimerCount()).toBe(0);
 }finally{vi.useRealTimers();}
});
import { BoundedStore } from '../src/playback/bounded-store';
it('bounds actual stored bytes and releases all pieces on destroy', async () => {
 const store=new BoundedStore(4,{length:8});
 const put=(i:number,b:Uint8Array)=>new Promise<Error|null>(r=>store.put(i,b,e=>r(e||null)));
 const get=(i:number)=>new Promise<Uint8Array>((r,j)=>store.get(i,{},(e,b)=>e?j(e):r(b!)));
 expect(await put(0,new Uint8Array([1,2,3,4]))).toBeNull();expect(await get(0)).toEqual(new Uint8Array([1,2,3,4]));
 expect(await put(2,new Uint8Array(4))).toBeInstanceOf(Error);
 expect(await put(1,new Uint8Array(5))).toBeInstanceOf(Error);
 expect(store.bytes).toBe(4);
 await new Promise<void>(r=>store.destroy(r));expect(store.bytes).toBe(0);await expect(get(0)).rejects.toThrow();
 expect(await put(0,new Uint8Array(4))).toBeInstanceOf(Error);
});
it('accepts only a bare v1 hash and one explicitly chosen secure tracker, never HTTP metadata or web seeds', () => {
 const hash='a'.repeat(40);
 expect(validatePeerInput(hash,'wss://tracker.example/announce')).toEqual({infoHash:hash,tracker:'wss://tracker.example/announce'});
 for(const value of ['magnet:?xt=urn:btih:'+hash, 'https://host/a.torrent',hash+' ']) expect(()=>validatePeerInput(value,'wss://tracker.example')).toThrow();
 for(const tracker of ['ws://localhost:8000','https://tracker.example','wss://user:pass@tracker.example','wss://tracker.example/#x','wss://tracker.example/?token=x','wss:tracker.example','wss://tracker.\nexample/','wss://tracker.example/'+ 'a'.repeat(2048)]) expect(()=>validatePeerInput(hash,tracker)).toThrow();
});
