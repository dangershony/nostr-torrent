import { it, expect, vi } from 'vitest';
import { finalizeEvent, generateSecretKey } from 'nostr-tools';
import { readRelays } from '../src/relay/read';
class Socket {
 readyState=1 as const; onopen: null|(()=>void)=null; onmessage:null|((e:{data:unknown})=>void)=null; onerror:null|(()=>void)=null; onclose:null|(()=>void)=null;
 send=vi.fn(); close=vi.fn();
 emit(value:unknown){this.onmessage?.({data:JSON.stringify(value)})}
}
const event=()=>finalizeEvent({kind:21,created_at:1,content:'',tags:[['title','Signed film'],['imeta','url https://media.example/a.mp4','m video/mp4']]},generateSecretKey());
it('verifies, deduplicates, isolates subscription IDs and closes on EOSE',()=>{
 const socket=new Socket(),received=vi.fn(); const stop=readRelays(['wss://relay.example'],received,()=>{},()=>socket);
 socket.onopen?.(); const id=JSON.parse(socket.send.mock.calls[0][0])[1]; const e=event();
 socket.emit(['EVENT','wrong',e]);socket.emit(['EVENT',id,{...e,content:'forged'}]);socket.emit(['EVENT',id,e]);socket.emit(['EVENT',id,e]);expect(received).toHaveBeenCalledTimes(1);
 socket.emit(['EOSE',id]);expect(socket.close).toHaveBeenCalledOnce();expect(socket.onmessage).toBeNull();stop();expect(socket.close).toHaveBeenCalledOnce();
});
it('bounds relay count, payloads, messages and deadline; cancellation cleans up',()=>{
 vi.useFakeTimers();const sockets:Socket[]=[]; const factory=()=>{const s=new Socket();sockets.push(s);return s};
 const stop=readRelays(Array.from({length:8},(_,i)=>`wss://relay${i}.example`),vi.fn(),()=>{},factory);
 expect(sockets).toHaveLength(3);sockets[0].onmessage?.({data:'x'.repeat(65537)});expect(sockets[0].close).toHaveBeenCalledOnce();
 for(let i=0;i<201;i++)sockets[1].emit(['NOTICE','spam']);expect(sockets[1].close).toHaveBeenCalledOnce();vi.advanceTimersByTime(10000);expect(sockets[2].close).toHaveBeenCalledOnce();stop();expect(vi.getTimerCount()).toBe(0);vi.useRealTimers();
});
it('deduplicates across relays and cancels both before their deadlines',()=>{
 vi.useFakeTimers();const sockets:Socket[]=[];const receive=vi.fn();const stop=readRelays(['wss://one.example','wss://two.example'],receive,()=>{},()=>{const s=new Socket();sockets.push(s);return s});const e=event();
 for(const s of sockets){s.onopen?.();const id=JSON.parse(s.send.mock.calls[0][0])[1];s.emit(['EVENT',id,e]);}expect(receive).toHaveBeenCalledOnce();stop();for(const s of sockets){expect(s.onmessage).toBeNull();expect(s.close).toHaveBeenCalledOnce();}expect(vi.getTimerCount()).toBe(0);vi.useRealTimers();
});
