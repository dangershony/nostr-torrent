// @vitest-environment node
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error Node-only build helper
import { verifyWebTorrentArtifacts } from '../scripts/verify-webtorrent.mjs';
it('checks the pinned engine and matching worker before bundling', () => {
 expect(verifyWebTorrentArtifacts()).toEqual({version:'3.0.21',verified:true});
 const load=(path:URL)=>readFileSync(path);
 expect(()=>verifyWebTorrentArtifacts((path:URL)=>path.pathname.endsWith('sw.min.js')?Buffer.from('wrong worker'):load(path))).toThrow('sw.min.js');
});
