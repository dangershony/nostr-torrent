import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { it, expect, afterEach, vi } from 'vitest';
import App from '../src/ui/App';
let root:Root;let host:HTMLDivElement;
it('closes an in-progress relay subscription when opening video details',async()=>{
 vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
 const schedule=vi.spyOn(globalThis,'setTimeout'),cancel=vi.spyOn(globalThis,'clearTimeout');
 const {finalizeEvent,generateSecretKey}=await import('nostr-tools');
 class FakeSocket{readyState=1;onopen:(()=>void)|null=null;onmessage:((e:{data:string})=>void)|null=null;onerror=null;onclose=null;send=vi.fn();close=vi.fn();constructor(){sockets.push(this)}}
 const sockets:FakeSocket[]=[];vi.stubGlobal('WebSocket',FakeSocket);
 try{
  await mount();await click('Relay catalogue');const input=host.querySelector<HTMLInputElement>('#relays')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'wss://relay.example');input.dispatchEvent(new Event('input',{bubbles:true}));});await click('Read relays');
  const socket=sockets[0];socket.onopen?.();const id=JSON.parse(socket.send.mock.calls[0][0])[1];
  const event=finalizeEvent({kind:21,created_at:1,content:'',tags:[['title','Relay film']]},generateSecretKey());
  await act(async()=>socket.onmessage?.({data:JSON.stringify(['EVENT',id,event])}));
  expect(socket.close).not.toHaveBeenCalled();await click('Relay film');
  expect(socket.send).toHaveBeenCalledWith(JSON.stringify(['CLOSE',id]));expect(socket.close).toHaveBeenCalledOnce();
  for(const handler of [socket.onopen,socket.onmessage,socket.onerror,socket.onclose])expect(handler).toBeNull();
  const deadline=schedule.mock.calls.findIndex(call=>call[1]===10000);expect(deadline).toBeGreaterThanOrEqual(0);
  expect(cancel).toHaveBeenCalledWith(schedule.mock.results[deadline].value);expect(host.querySelector('#detail-title')?.textContent).toBe('Relay film');
 }finally{vi.useRealTimers();vi.unstubAllGlobals();}
});
async function mount(){host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<App/>));}
async function click(text:string){const button=Array.from(host.querySelectorAll('button')).find(x=>x.textContent?.includes(text));expect(button).toBeDefined();await act(async()=>button!.click());}
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();vi.restoreAllMocks();});
it('browses labelled fixtures, filters and opens keyboard-friendly details with no media requests',async()=>{
 await mount();expect(host.textContent).toContain('Local fixtures');expect(host.querySelectorAll('video[src],img[src],iframe')).toHaveLength(0);expect(host.querySelectorAll('[data-card]')).toHaveLength(6);
 await click('Documentary');expect(host.querySelectorAll('[data-card]')).toHaveLength(2);
 await click('All films');await click('Sintel');expect(host.querySelector('[aria-labelledby="detail-title"]')).not.toBeNull();expect(host.textContent).toContain('Active transport: none');expect(host.querySelector('video')?.hasAttribute('src')).toBe(false);
 const start=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Play via HTTP'));expect(start?.disabled).toBe(true);
 await click('Back to catalogue');expect(host.querySelector('video')).toBeNull();
});
it('plays the selected HTTP demo directly from the consented primary action',async()=>{
 vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 const play=vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
 await mount();await click('Sintel');
 const start=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Play via HTTP');
 expect(start).toBeDefined();expect(start?.disabled).toBe(true);expect(play).not.toHaveBeenCalled();
 await act(async()=>host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
 expect(play).not.toHaveBeenCalled();await click('Play via HTTP');
 expect(play).toHaveBeenCalledOnce();expect(host.querySelector('video')?.src).toContain('sintel_trailer-480p.mp4');
 await act(async()=>host.querySelector('video')!.dispatchEvent(new Event('playing')));
 expect(host.textContent).toContain('Playing via HTTP');
});
it('loads HTTP only after explicit consent and stops on leaving details',async()=>{
 vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
 vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});vi.spyOn(HTMLMediaElement.prototype,'canPlayType').mockReturnValue('probably');
 await mount();await click('Sintel');const checkbox=host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;await act(async()=>checkbox.click());await click('Play via HTTP');const video=host.querySelector('video')!;expect(video.src).toMatch(/^https:/);await act(async()=>video.dispatchEvent(new Event('loadeddata')));expect(host.textContent).toContain('Active transport: HTTP');await click('Back to catalogue');expect(video.hasAttribute('src')).toBe(false);
});
it('searches with a labelled field and explains empty results',async()=>{
 await mount();const input=host.querySelector<HTMLInputElement>('[aria-label="Search films"]')!;expect(input).not.toBeNull();
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'no matching film');input.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(host.querySelectorAll('[data-card]')).toHaveLength(0);expect(host.textContent).toContain('No films found');
});
it('keeps relay connections opt-in and exposes semantic keyboard controls',async()=>{
 const Socket=vi.fn();vi.stubGlobal('WebSocket',Socket);await mount();await click('Relay catalogue');expect(Socket).not.toHaveBeenCalled();expect(host.querySelector('label[for="relays"]')).not.toBeNull();expect(host.querySelector('.skip')?.getAttribute('href')).toBe('#main');await click('Read relays');expect(host.textContent).toContain('Enter a valid public wss:// relay URL');expect(Socket).not.toHaveBeenCalled();vi.unstubAllGlobals();
});
it('renders a real signed relay event as safe text and cancels the subscription on unmount',async()=>{
 const {finalizeEvent,generateSecretKey}=await import('nostr-tools');
 class FakeSocket{readyState=1;onopen:(()=>void)|null=null;onmessage:((e:{data:string})=>void)|null=null;onerror=null;onclose=null;send=vi.fn();close=vi.fn();constructor(){sockets.push(this)}}
 const sockets:FakeSocket[]=[];vi.stubGlobal('WebSocket',FakeSocket);await mount();await click('Relay catalogue');const input=host.querySelector<HTMLInputElement>('#relays')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'wss://relay.example');input.dispatchEvent(new Event('input',{bubbles:true}));});await click('Read relays');
 const socket=sockets[0];socket.onopen?.();const id=JSON.parse(socket.send.mock.calls[0][0])[1];const e=finalizeEvent({kind:21,created_at:1,content:'Untrusted description',tags:[['title','<img src=x onerror=alert(1)>'],['imeta','url https://media.example/a.mp4','m video/mp4']]},generateSecretKey());
 await act(async()=>socket.onmessage?.({data:JSON.stringify(['EVENT',id,e])}));expect(host.querySelectorAll('[data-card]')).toHaveLength(1);expect(host.querySelector('img')).toBeNull();expect(host.textContent).toContain('<img src=x onerror=alert(1)>');expect(host.textContent).toContain('1 verified entries');await act(async()=>root.unmount());expect(socket.close).toHaveBeenCalledOnce();vi.unstubAllGlobals();
});
