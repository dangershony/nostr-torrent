export type HttpSource = { type: 'http'; url: string; mime: string; sha256?: string };
export type PeerSource = { type: 'p2p'; infoHash: string; trackers: string[] };
export type Source = HttpSource | PeerSource;
export interface Video { id:string; title:string; description:string; creator:string; category:string; sources:Source[]; origin:'fixture'|'relay'; duration?:number; warning?:string; }
