# nostr-torrent

## Goal
A simple video-only Nostr client combining film/documentary browsing with creator channels. Viewers choose a video and press Play; torrent mechanics stay behind the interface. Target web, mobile, desktop and TVs, including LG webOS. Native platform support is a goal, not an existing feature.

## Confirmed decisions
- Owner: dangershony. Repository: dangershony/nostr-torrent. Keep private.
- All external repository changes are restricted to this repository.
- TypeScript and React for the initial client; WebTorrent for the first browser transport experiment.
- Nostr carries signed catalogue and social metadata; video travels through peers or optional HTTP sources.
- Verify real mobile playback early. A responsive desktop UI alone does not satisfy the goal.

## Initial scope
- Browse, search, filter and open video details.
- Read NIP-71 video events and NIP-35 torrent entries.
- Play browser-compatible video from WebRTC peers, with explicit optional HTTP fallback.
- Show useful loading, unavailable-source, unsupported-format and retry states.
- Keep torrent and player adapters separate from catalogue/UI code so native transports can be added.
- No private-key entry or public publishing required for the first playback prototype.

## Implementation sequence
1. Build the React/TypeScript shell, video model and untrusted metadata parsers. Include labelled local fixtures for development; never present them as live Nostr results.
2. Read a bounded number of signed video events from configurable relays. Validate signatures, limit payloads, deduplicate events and clean up subscriptions.
3. Prove playback with one redistributable video and a controlled WebRTC-compatible seed. Implement seek, cancellation, errors and resource cleanup. Test on desktop and a real Android browser, then iOS Safari.
4. Add optional HTTP fallback, disclose the active transport and avoid claiming peer-to-peer success when playback came from HTTP.
5. Add creator pages, follows, watch-later and private/local playback progress.
6. Evaluate desktop packaging and native mobile transport adapters. Prototype TV remote navigation and webOS playback; assess whether a local or hosted gateway is necessary.
7. Add creator publishing, encoding, persistent seeding and monetisation after playback works reliably.

## Technical constraints to validate
- Browser WebTorrent peers use WebRTC; arbitrary traditional BitTorrent swarms are not automatically browser-compatible.
- Reliable availability needs a persistent seed or an HTTP source. Nostr metadata replication does not preserve the video itself.
- Codec/container compatibility is separate from successful torrent delivery.
- Proposed initial media baseline: MP4, H.264 video, AAC audio, fast-start metadata and optional WebVTT captions. Confirm on actual target devices.
- TV runtimes vary; do not promise one torrent implementation on every platform.
- HTTP and torrent sources must identify matching content before being treated as interchangeable.
- NIP-71/NIP-35 linkage requires an explicit documented convention; do not claim an app-specific tag is a standard.
- BitTorrent info hashes and whole-file SHA-256 hashes are different identifiers.
- P2P sharing exposes network addresses to peers and uses upload bandwidth. Explain this before enabling it and provide upload/cache controls.

## Prototype acceptance criteria
- Installation and build instructions are reproducible.
- A real Nostr event can populate a video card with untrusted fields rendered safely.
- A controlled torrent plays before the complete file downloads; seeking works while more pieces arrive.
- Tests distinguish torrent transfer from HTTP fallback.
- Zero-peer and unsupported-format cases end with an actionable message rather than an endless spinner.
- Playback stops, peers disconnect and resources are released when a video is closed.
- Touch targets and keyboard focus work on a narrow screen; record actual device/browser versions tested.
- No credentials, Nostr private keys or user watch history are committed or published.

## Open decisions
Brand/design, public release licence, hosting provider, persistent seed funding and native TV packaging remain undecided. No paid infrastructure or public deployment is authorised by this document.

## References
- https://github.com/nostr-protocol/nips/blob/master/71.md
- https://github.com/nostr-protocol/nips/blob/master/35.md
- https://webtorrent.io/docs
- https://webtorrent.io/faq
- https://webostv.developer.lge.com/develop/specifications/streaming-protocol-drm

## Status
Planning foundation only. No application, live playback or device compatibility has been implemented or verified yet.
