import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { openPeerSession } from '../src/playback/torrent';
const state=vi.hoisted(()=>({client:undefined as any,torrent:undefined as any}));
vi.mock('webtorrent/dist/webtorrent.min.js',()=>({default:class extends EventEmitter {
 destroyed=false;
 constructor(){super();state.client=this;}
 add=vi.fn(()=>state.torrent);
 createServer=vi.fn();
 destroy=vi.fn((cb?:()=>void)=>{this.destroyed=true;cb?.();});
}}));
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
function setup(register:()=>Promise<{active:unknown}>=vi.fn(async()=>({active:{}}))) {
 const media=document.createElement('video');media.pause=vi.fn();media.load=vi.fn();
 const torrent=Object.assign(new EventEmitter(),{wires:[] as {type:string;destroy:ReturnType<typeof vi.fn>}[]});state.torrent=torrent;state.client=undefined;
 vi.stubGlobal('navigator',{locks:{request:async(_name:string,_opts:unknown,callback:(lock:object)=>Promise<void>)=>callback({})},serviceWorker:{register,controller:{scriptURL:new URL('/sw.min.js',location.href).href}}});
 return {media,torrent,update:vi.fn()};
}
it('cancels the worker-control polling timer immediately when aborted',async()=>{
 vi.useFakeTimers();const register=vi.fn(async()=>({active:null}));const fixture=setup(register);const abort=new AbortController();
 const session=openPeerSession({...fixture,infoHash:'a'.repeat(40),tracker:'wss://tracker.example',consent:true,signal:abort.signal});
 try {
  await vi.waitFor(()=>expect(register).toHaveBeenCalledOnce());
  abort.abort();
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(1000);
  expect(state.client.add).not.toHaveBeenCalled();expect(state.client.createServer).not.toHaveBeenCalled();expect(state.client.destroy).toHaveBeenCalledOnce();
 }finally{session.stop();}
});
it('rejects metadata with no supported MP4 instead of waiting for an impossible selection',async()=>{
 const fixture=setup();Object.assign(fixture.torrent,{length:1024,pieceLength:1024,pieces:[{}],files:[{name:'film.mkv',type:'video/x-matroska',length:1024}]});
 const session=openPeerSession({...fixture,infoHash:'a'.repeat(40),tracker:'wss://tracker.example',consent:true});
 try {
  await vi.waitFor(()=>expect(state.client?.add).toHaveBeenCalledOnce());
  state.client.add.mock.calls[0][2](fixture.torrent);
  expect(fixture.update.mock.lastCall?.[0]).toMatchObject({phase:'error',message:expect.stringContaining('supported MP4')});
  expect(state.client.destroy).toHaveBeenCalledOnce();
 }finally{session.stop();}
});
it('applies the established-wire cap when the real session receives a wire event',async()=>{
 const fixture=setup();const session=openPeerSession({...fixture,infoHash:'a'.repeat(40),tracker:'wss://tracker.example',consent:true});
 try {
  await vi.waitFor(()=>expect(state.client?.add).toHaveBeenCalledOnce());
  fixture.torrent.wires=Array.from({length:5},()=>({type:'webrtc',destroy:vi.fn()}));
  fixture.torrent.emit('wire',fixture.torrent.wires[4]);
  expect(fixture.torrent.wires[4].destroy).toHaveBeenCalledOnce();
 }finally{session.stop();}
});
