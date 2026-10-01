# Desktop smoke evidence

This is evidence from the running prototype in the Hermes desktop preview (Electron/Chromium), not a physical-phone test or a P2P playback claim.

## Observed

- `npm run dev -- --port 5173 --strictPort` serves on loopback only. HTTP health request returned the application HTML.
- Rendered catalogue shows six cards explicitly labelled LOCAL FIXTURE, with generated local CSS artwork and no claim that fixtures came from a relay.
- Opened Relay catalogue, entered `wss://relay.damus.io`, pressed Read relays. The interface moved from Reading signed metadata to “Relay read timed out after 10 seconds. Retry available. · 0 verified entries”. A genuine live-event card has NOT been verified.
- Returned to Local fixtures and opened Sintel. Load selected source was disabled before HTTP consent, enabled after consent.
- Pressed Load selected source for `download.blender.org`. The player reached “Active transport: HTTP” and “Ready. Use the player controls to play or seek.” This confirms HTTP media loaded to the adapter's loadeddata threshold; continuous playback and seeking were not measured.
- Pressed Stop & clear session. The rendered interface changed to “Active transport: none” and “Stopped. No active transport.” Unit tests separately cover cleanup mechanics; this UI observation alone is not network-level teardown proof.

## Boundaries

No WebTorrent transfer, progressive P2P playback, physical Android, iOS Safari or webOS run has been performed. Do not count HTTP loading, local fixtures or mocked relay/torrent logic as those acceptance gates.
