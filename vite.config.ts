import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
// @ts-expect-error Node-only artifact verifier
import { verifyWebTorrentArtifacts } from './scripts/verify-webtorrent.mjs';
verifyWebTorrentArtifacts();
// Copy the worker from the exact engine version, including on Pages project builds.
export default defineConfig({
 plugins:[{name:'webtorrent-worker',generateBundle(){this.emitFile({type:'asset',fileName:'sw.min.js',source:readFileSync(new URL('./src/playback/stream-worker.js',import.meta.url))});},configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]===`${server.config.base}sw.min.js`){res.setHeader('Content-Type','application/javascript');res.end(readFileSync(new URL('./src/playback/stream-worker.js',import.meta.url)));}else next();});}}],
 test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'] }
});
