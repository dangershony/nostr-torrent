# Controlled browser WebTorrent playback

## What works

The controlled P2P panel lazy-loads the pinned WebTorrent 3.0.21 browser ESM distribution after explicit consent. A seed browser hashes and shares a user-selected authorized MP4; a receiver enters its bare v1 hash and the same WSS tracker, loads peer metadata, then explicitly selects an MP4. No demo hash pretends to be an always-on swarm. The separate Sintel HTTP demo remains available, but is never an automatic P2P fallback.

The app emits its own project-owned service worker (`src/playback/stream-worker.js`, served as `sw.min.js`) and waits for both activation and control of the page. For Pages builds these are `/nostr-torrent/sw.min.js` and scope `/nostr-torrent/`. Unlike the upstream WebTorrent worker, it does not broadcast stream requests to all same-origin windows: each stream URL carries a random 256-bit capability bound to the exact requesting client ID, and only the file the receiver explicitly selected is served. The stream URL under `/nostr-torrent/webtorrent/` is a local service-worker response from verified torrent pieces, not an HTTP media server.

Only a receiver creates a stream bridge. A base-scoped exclusive Web Lock prevents two receiver tabs from claiming the streaming role simultaneously. Seed tabs do not create stream servers. Web Locks and secure service-worker support are required; stop holds ownership until engine destruction finishes. The custom worker replaces the upstream `BrowserServer`, so the upstream EOF keepalive-timer leak does not apply; repeated sessions and Stop are covered by lifecycle tests.

## Reproduce without a public seed

Requires Node >=22.12, npm, Chromium, ffmpeg with libx264, and OpenSSL. The local fixture creates its own 120-second 640×360 H.264 test-pattern video; it does not download or redistribute another creator's video. It creates an ephemeral self-signed certificate and loopback-only WSS signaling tracker. **There is no HTTP media server.**

Automated proof:

```sh
npm ci
npm test
npm run typecheck
CHROMIUM_PATH=/usr/bin/chromium npm run test:video
```

`test:video` builds a Pages-base preview and runs both HTTP and torrent tests. `npm run test:torrent` runs just the torrent proof. Tests use two isolated browser contexts, an actual tracker, actual WebRTC data channels, and the real pinned engine. Chromium's certificate exception is confined to those disposable contexts; no system trust store or user browser profile is changed.

Interactive demo, first terminal:

```sh
npm run build -- --base=/nostr-torrent/
npm exec vite -- preview --host 127.0.0.1 --port 4173 --strictPort --base=/nostr-torrent/
```

Second terminal:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run demo:p2p -- --open
```

The command prints the generated file path and tracker URL and opens separate seed/receiver windows. In the seed window select that generated file, consent, and start seeding. Copy the displayed info hash to the receiver; consent, load metadata, select its MP4, and play. Keep the seed window open. Stop in both windows and Ctrl-C the fixture when finished. The fixture deletes its generated media and certificate on cleanup. No public tracker, hosted seed, paid service or Nostr publishing is required.

## Safety and resource boundaries

- Consent discloses IP exposure to the tracker/peers and upload bandwidth while watching. Changing inputs requires fresh consent. Revoking consent, leaving the panel, pagehide, explicit stop, deadline and AbortSignal cancel the session.
- Only a 40-hex-character v1 info hash and one explicit `wss://` tracker are accepted. Magnets, `xs`, torrent URLs, HTTP trackers, credentials, query strings and fragments are rejected. Web seeds, DHT, LSD, peer exchange and STUN/TURN services are disabled. This deliberately limits peer reachability to same-network/directly reachable peers.
- Nothing downloads before explicit file selection. Selection is an exact metadata index, not a filename guessed from catalogue text. Only nonempty MP4 files are supported; actual codec support is still determined by the browser and decode failures stop peers.
- One torrent/session; 64 MiB total, 100 files, 4096 pieces and 4 MiB/piece metadata bounds. The custom volatile piece store independently enforces a 64 MiB stored-payload ceiling and discards pieces on destruction. Protocol buffers, file copies and browser allocations mean this is **not a 64 MiB total process-memory guarantee**. Browser metadata parsing occurs before the application's metadata checks.
- Four established WebRTC wires are retained; excess wires are closed after handshake. Upstream `maxConns` governs TCP queues, not a hard browser WebRTC socket limit. Transient signaling/ICE connections can exceed four; this is not an untrusted-tracker connection-flood defense.
- Upload target 512 KiB/s and download target 1 MiB/s use the engine's throttles, not total network-interface limits. Protocol/signaling overhead is excluded. Sharing expires after 30 minutes. Stop disconnects peers and clears the volatile store; it does not unregister the shared worker.
- Metadata/initial data deadlines and playback stalls fail after 20 seconds. No-peer, unsupported-format, decode and setup failures display actionable errors; no automatic reconnect or HTTP fallback is started.
- Lazy imports and worker registration cannot be canceled by the browser API itself. Late completions are guarded; stopped sessions do not create a stream server or join a tracker. The worker-control polling timer is explicitly cleared and its pending continuation released.

## Pinned artifacts

`package.json` pins `webtorrent` to `3.0.21`; package-lock pins its npm tarball integrity. The registry integrity was checked against the lock:

```
sha512-PFgLphma0dsUWmbWrZ016Cja+j+3D3DXuhk09A5u9qVAzH1T4Vj1VZd8j+zb8sDwPv7NA7+qgPtDEN4iFd6wdw==
```

`scripts/verify-webtorrent.mjs` rejects changed versions or bytes when Vite starts:

| Artifact | SHA-256 |
|---|---|
| dist/webtorrent.min.js | db4dca98cd135c732eeffdede3cf5f8febd0585a0eba4dc4d1effa1b901f4c3d |
| dist/sw.min.js (upstream reference) | 9aa1f71d26b4d4eb51786baa575309ca550fdfd9c96842fe25a3b643f2173da2 |

The upstream digests are checked at build time against the pinned package. The emitted `sw.min.js` is the project-owned stream worker, not the upstream artifact; the engine bundle `webtorrent.min.js` remains the pinned upstream distribution.

The production engine remains a separately fetched lazy chunk. No CDN engine script or Node-polyfill entry is used.

## Recorded real-browser evidence

See [p2p-evidence.json](p2p-evidence.json), captured from the real Playwright run in Chromium **151.0.7922.173** on Linux, desktop 1440×1000 and narrow 390×844 viewports.

Both receivers advanced beyond 0.5 seconds with **938,220 / 22,548,716** torrent bytes downloaded and **15 verified pieces**, before the full torrent download. Both sought to 90 seconds and resumed; captured times were 90.735214 and 90.774138 seconds, with decoded frames and 640×360 video dimensions. Application counters include only wires with `wire.type === 'webrtc'`; independent RTCPeerConnection `data-channel` stats also showed received bytes. Seed-side WebRTC upload counters increased. The recorded network-media and unexpected-HTTP lists were empty, and only the chosen loopback WSS tracker was contacted.

The proof also rejects a rival receiver tab, stops during a held lazy import without opening sockets, stops after seed loss/stall, times out an empty swarm, verifies peer connections close, and clears the video URL. HTTP demo playback and seeking passed separately against the real Blender MP4.

Results: **56 unit tests passed; 10 Playwright tests passed; typecheck and production build passed.** Unit lifecycle tests use a mocked engine solely to exercise cancellation and hostile metadata deterministically; they are not P2P-transfer evidence. Narrow desktop Chromium is not Android/iOS/TV device validation.

## Audit blocker and remaining limitations

Both `npm audit` and `npm audit --omit=dev` report **4 high-severity dependency findings**, stemming from `ip` / GHSA-2p57-rm9w-gvfp through bittorrent-tracker → torrent-discovery → webtorrent. Audit is **not clean**. npm's proposed force fix downgrades bittorrent-tracker incompatibly; it was not applied. The installed tracker source imports `ip` in its Node UDP parser; the local fixture disables UDP and binds loopback. This contextualizes exposure, but does not erase the dependency finding or substitute for independent security review.

No always-on public seed, WAN/NAT reliability, adversarial-tracker resilience, physical mobile/TV compatibility, deployment, commit or push is claimed by this proof. The implementation intentionally uses a controlled manual file workflow rather than asserting arbitrary BitTorrent swarms are browser-playable.
