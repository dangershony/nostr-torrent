import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Published webtorrent@3.0.21 npm dist artifacts; package-lock pins the tarball integrity.
const digests={
 'webtorrent.min.js':'db4dca98cd135c732eeffdede3cf5f8febd0585a0eba4dc4d1effa1b901f4c3d',
 'sw.min.js':'9aa1f71d26b4d4eb51786baa575309ca550fdfd9c96842fe25a3b643f2173da2',
};
export function verifyWebTorrentArtifacts(read=readFileSync) {
 const pkg=JSON.parse(read(new URL('../node_modules/webtorrent/package.json',import.meta.url)));
 if(pkg.version!=='3.0.21')throw Error('Expected pinned WebTorrent 3.0.21');
 for(const [file,expected] of Object.entries(digests)) {
  const digest=createHash('sha256').update(read(new URL(`../node_modules/webtorrent/dist/${file}`,import.meta.url))).digest('hex');
  if(digest!==expected)throw Error(`WebTorrent artifact mismatch: ${file}`);
 }
 return {version:pkg.version,verified:true};
}
