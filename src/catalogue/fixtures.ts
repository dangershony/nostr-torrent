import type { Video } from './model';
/** Local editorial fixtures, never signed events or live relay results. */
export const fixtures:Video[]=[
 {id:'sintel',title:'Sintel',category:'Animation',creator:'Blender Foundation',duration:52,description:'Watch the 52-second Sintel open-movie trailer — an HTTP demo, not torrent playback or the full film. © copyright Blender Foundation | durian.blender.org. Licensed CC BY 3.0. The external media host receives your IP only after consent and Play. Availability depends on that host.',sources:[{type:'http',url:'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4',mime:'video/mp4'}]},
 {id:'quiet-earth',title:'The Quiet Earth',category:'Documentary',creator:'Example studio',duration:2460,description:'An imagined study of wild landscapes and the people who listen to them. Editorial development fixture; no playable media is attached.',sources:[]},
 {id:'blue-hour',title:'Blue Hour',category:'Film',creator:'Example studio',duration:1080,description:'One city. A thousand stories between night and morning. Fictional development fixture with no media source.',sources:[]},
 {id:'ocean',title:'Below the Surface',category:'Documentary',creator:'Example studio',duration:3120,description:'An imagined expedition into the deep. Development fixture, not a real catalogue release.',sources:[]},
 {id:'orbit',title:'A Small Orbit',category:'Animation',creator:'Example studio',duration:480,description:'A little world with room for a big adventure. Fictional development fixture with no media source.',sources:[]},
 {id:'last-light',title:'The Last Light',category:'Film',creator:'Example studio',duration:1680,description:'An imagined story about finding the way home. Development fixture; no playable media is attached.',sources:[]},
].map(v=>({...v,origin:'fixture'} as Video));
