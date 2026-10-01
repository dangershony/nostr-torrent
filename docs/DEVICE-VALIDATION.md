# Playback acceptance evidence

Status: physical Android, physical iOS and LG webOS testing has NOT been performed. Desktop browser emulation is not device evidence.

## Record per run

- Date, application commit, device model, OS version, browser/runtime version.
- Network topology and whether both peers are local or cross-network.
- Media source, licence/redistribution permission, container, video/audio codecs, duration and size.
- Torrent infohash and whole-file SHA-256 recorded as separate identifiers.
- Seed/tracker versions and actual transport label shown by the client.

## Controlled torrent gate

1. Use an owned or redistributable fast-start MP4 with H.264/AAC. Run a controlled WebRTC-capable seed; a traditional BitTorrent seed alone is insufficient.
2. Turn off HTTP fallback and web seeds. Capture network requests and torrent peer/byte counters.
3. Consent to the network-address exposure and upload-bandwidth warning.
4. Record first decoded frame before the complete file is downloaded; record downloaded bytes vs total at that moment.
5. Seek forward while missing pieces remain. Record decoded playback resuming, buffering time and incoming pieces.
6. Stop/close video. Verify connections, timers, video source and cache resources are released. Reopen/retry without duplicates.
7. Repeat with zero peers, lost tracker, unavailable file, unsupported codec, aborted metadata fetch and repeated rapid open/close. Every case must reach a useful error or cancellation state rather than spin forever.

## HTTP gate (separate)

Select HTTP explicitly, record consent and actual HTTP transport. Verify playback, seek/range support, missing media, codec error and cleanup. This never counts as P2P success. Do not claim alternate-source equivalence without content matching.

## Interaction gate

Verify narrow-screen layout, touch target sizes, keyboard focus visibility/order, detail close/back focus restoration, accessible names and readable status/errors. Test physical Android Chrome first, then iOS Safari. TV/webOS requires its own remote-control, codec and memory checks.

## Results

No physical-device results yet. Fill this section only from observed runs with evidence; do not substitute generated fixtures or mocked adapters.
