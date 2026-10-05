declare module 'webtorrent/dist/webtorrent.min.js' {
 interface Events { on(event:string, listener:(...args:any[])=>void):this; }
 export interface TorrentFile {name:string;path:string;length:number;type:string;[Symbol.asyncIterator](options:{start:number;end:number}):AsyncIterableIterator<Uint8Array>;}
 export interface Torrent extends Events {infoHash:string;length:number;downloaded:number;uploaded:number;numPeers:number;files:TorrentFile[];pieces:unknown[];pieceLength:number;bitfield?:{get(index:number):boolean};wires:{type:string;downloaded:number;uploaded:number;destroy:()=>void}[];destroyed:boolean;}
 export default class WebTorrent implements Events {
 constructor(options:Record<string,unknown>);
 on(event:string,listener:(...args:any[])=>void):this;
 destroyed:boolean;
 add(hash:string,options:Record<string,unknown>,ready:(torrent:Torrent)=>void):Torrent;
 seed(file:File,options:Record<string,unknown>,ready:(torrent:Torrent)=>void):Torrent;
 createServer(options:Record<string,unknown>):void;
 destroy(callback?:()=>void):void;
 }
}
