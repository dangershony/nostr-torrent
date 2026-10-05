import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:https';
import Tracker from 'bittorrent-tracker/server';

/** Loopback-only signaling. No HTTP file server, seed or third-party network calls. */
export async function createLocalPeerFixture() {
 const dir=mkdtempSync(join(tmpdir(),'nostr-p2p-'));
 let tracker,server;
 try {
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
  const file=join(dir,'generated-demo.mp4');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=640x360:rate=24','-t','120','-c:v','libx264','-preset','ultrafast','-b:v','1500k','-pix_fmt','yuv420p','-movflags','+faststart',file]);
  tracker=new Tracker({http:false,udp:false,ws:{noServer:true},stats:false,interval:600000});
  server=createServer({key:readFileSync(join(dir,'key.pem')),cert:readFileSync(join(dir,'cert.pem'))},(_req,res)=>{res.writeHead(404);res.end('Signaling only. No HTTP media is served.');});
  server.on('upgrade',(req,socket,head)=>tracker.ws.handleUpgrade(req,socket,head,ws=>tracker.ws.emit('connection',ws,req)));
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const trackerUrl=`wss://127.0.0.1:${server.address().port}`;
  let closed=false;
  return {file,trackerUrl,async close(){if(closed)return;closed=true;await new Promise(resolve=>tracker.close(resolve));await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});}};
 } catch(error){tracker?.close();server?.close();rmSync(dir,{recursive:true,force:true});throw error;}
}
