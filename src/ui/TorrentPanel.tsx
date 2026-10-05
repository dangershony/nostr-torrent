import './TorrentPanel.css';
import { useEffect, useRef, useState } from 'react';
import { emptyStats, openPeerSession, type PeerView } from '../playback/torrent';
import type { PeerSource } from '../catalogue/model';

export function TorrentPanel({onBack,source}:{onBack?:()=>void;source?:PeerSource}) {
 const media=useRef<HTMLVideoElement>(null),session=useRef<ReturnType<typeof openPeerSession>|undefined>(undefined);
 const [mode,setMode]=useState<'receive'|'seed'>('receive'),[hash,setHash]=useState(source?.infoHash||''),[tracker,setTracker]=useState(source?.trackers[0]||''),[file,setFile]=useState<File>(),[consent,setConsent]=useState(false),[selection,setSelection]=useState('');
 const [view,setView]=useState<PeerView>({phase:'idle',message:'No P2P connections. A controlled seed must be online; this is not an always-on public stream.',stats:emptyStats()});
 const stop=()=>{session.current?.stop();session.current=undefined;setSelection('');};
 useEffect(()=>{const close=()=>session.current?.stop();window.addEventListener('pagehide',close);return()=>{window.removeEventListener('pagehide',close);close();};},[]);
 const busy=!['idle','error'].includes(view.phase);
 return <section className="torrent-panel details" aria-labelledby="torrent-title">
  <button onClick={onBack}>{onBack?'← Back to catalogue':null}</button>{onBack&&<h1 id="torrent-title">Controlled P2P demo</h1>}
  <p>No HTTP media fallback. Browser WebRTC peers only. Keep an authorized seed tab open in a separate browser profile or device.</p>
  <div className="actions"><button aria-pressed={mode==='receive'} onClick={()=>{stop();setMode('receive');setConsent(false);}}>Receive from peers</button><button aria-pressed={mode==='seed'} onClick={()=>{stop();setMode('seed');setConsent(false);}}>Seed a local file</button></div>
  <div className="source-panel">
   <label htmlFor="peer-tracker">WSS tracker</label><input id="peer-tracker" placeholder="wss://your-controlled-tracker.example" maxLength={2048} value={tracker} disabled={busy} onChange={e=>{setTracker(e.target.value);setConsent(false);}}/>
   {mode==='receive'?<><label htmlFor="peer-hash">Torrent info hash</label><input id="peer-hash" maxLength={40} value={hash} disabled={busy} onChange={e=>{setHash(e.target.value);setConsent(false);}}/></>:<><label htmlFor="seed-file">Authorized MP4 file</label><input id="seed-file" type="file" accept="video/mp4,.mp4" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]);setConsent(false);}}/><p>Choose only a file you own or are authorized to redistribute, such as your own generated demo. The entire selected file will be shared, not just the viewed portion.</p></>}
   <p>P2P exposes your IP address to the chosen tracker and peers, and uses upload bandwidth even while watching. No STUN/TURN services are contacted: same-network or directly reachable peers only. Public trackers are experiments, not availability guarantees.</p>
   <p>Limits: one torrent, 64 MiB total, 4 established WebRTC wires (excess wires closed after handshake; transient signaling connections can exceed this); upload target 512 KiB/s, download target 1 MiB/s (protocol overhead excluded). Sharing expires after 30 minutes. Stop disconnects peers and requests cache cleanup. Browser memory can exceed the media size.</p>
   <label className="consent"><input type="checkbox" checked={consent} onChange={e=>{setConsent(e.target.checked);if(!e.target.checked)stop();}}/>I consent to P2P IP exposure and upload bandwidth.</label>
   <div className="actions"><button className="primary" disabled={!consent||busy||(mode==='seed'&&!file)} onClick={()=>{stop();session.current=openPeerSession({infoHash:hash,tracker,file:mode==='seed'?file:undefined,consent,media:media.current!,update:setView});}}>{mode==='seed'?'Start seeding':'Load peer metadata'}</button><button onClick={stop}>Stop P2P & clear session</button></div>
  </div>
  <p role="status" className={view.phase==='error'?'error':'status'}>{view.message}</p>
  {view.hash&&<p>Share torrent info hash: <code data-testid="seed-hash">{view.hash}</code></p>}
  {view.files&&<div className="source-panel"><label htmlFor="torrent-file">Torrent file</label><select id="torrent-file" value={selection} disabled={view.phase!=='metadata'} onChange={e=>setSelection(e.target.value)}><option value="">Select a file — nothing selected</option>{view.files.map((f,i)=><option key={i} value={i} disabled={f.type!=='video/mp4'}>{f.name} · {f.length} bytes · {f.type}</option>)}</select><button className="primary" disabled={selection===''||view.phase!=='metadata'} onClick={()=>session.current?.play(Number(selection))}>Play selected file via P2P</button></div>}
  <video ref={media} controls playsInline preload="none" aria-label="P2P player"/>
  <p className="transport">Active transport: {busy?'P2P':'none'}</p>
  <details><summary>Live WebRTC transfer evidence (bytes and verified pieces)</summary><pre data-testid="peer-stats">{JSON.stringify(view.stats)}</pre></details>
 </section>;
}
