import { describe, it, expect } from 'vitest';
import { finalizeEvent, generateSecretKey } from 'nostr-tools';
import { parseEvent, safeUrl } from '../src/catalogue/parser';
const sign = (kind=21, tags: string[][]=[['title','A film'],['imeta','url https://media.example/film.mp4','m video/mp4','x '+ 'a'.repeat(64)]]) => finalizeEvent({kind,tags,content:'<script>hostile</script>',created_at:1},generateSecretKey());
describe('hostile catalogue boundary',()=>{
 it.each(['https://server.local./a.mp4','https://server.localhost./a.mp4','wss://server.local.','wss://server.localhost.'])('rejects private hostname trailing-dot bypass: %s',url=>{expect(safeUrl(url,url.startsWith('wss:')?'wss:':'https:')).toBeUndefined();});
 it('parses signed NIP-71 imeta and keeps plain text',()=>{ const v=parseEvent(sign()); expect(v?.title).toBe('A film'); expect(v?.sources[0]).toMatchObject({type:'http',sha256:'a'.repeat(64)}); expect(v?.description).toContain('<script>'); });
 it('rejects invalid signatures and malformed/bounded data',()=>{const e=sign(); expect(parseEvent({...e,content:'tampered'})).toBeNull(); for(const value of [null,{}, {...e,tags:[null]}, {...e,content:'a'.repeat(70000)}]) expect(parseEvent(value)).toBeNull();});
 it('separates torrent info hash from file hash and filters trackers',()=>{const v=parseEvent(sign(2003,[['title','Torrent'],['x','b'.repeat(40)],['file','movie.mp4','100'],['tracker','wss://tracker.example'],['tracker','udp://tracker.example']])); expect(v?.sources[0]).toEqual({type:'p2p',infoHash:'b'.repeat(40),trackers:['wss://tracker.example/']});});
 it('rejects non-video torrents, missing addressable identifiers and unsafe URLs',()=>{expect(parseEvent(sign(2003,[['x','a'.repeat(40)],['file','a.exe']]))).toBeNull(); expect(parseEvent(sign(34235))).toBeNull(); for(const u of ['javascript:alert(1)','http://x.test/a','https://user:pass@x.test','https://127.0.0.1/a']) expect(safeUrl(u)).toBeUndefined();});
});
