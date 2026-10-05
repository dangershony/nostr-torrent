// @vitest-environment node
import { it, expect, vi } from 'vitest';
it('refuses to configure a build when the engine artifacts fail integrity verification',async()=>{
 vi.doMock('../scripts/verify-webtorrent.mjs',()=>({verifyWebTorrentArtifacts:()=>{throw Error('artifact mismatch');}}));
 try {await expect(import('../vite.config')).rejects.toThrow('artifact mismatch');}
 finally {vi.doUnmock('../scripts/verify-webtorrent.mjs');vi.resetModules();}
});
