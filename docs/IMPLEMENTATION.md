# Prototype implementation status

## Implemented

- React/TypeScript catalogue with explicitly labelled local fixtures, search, category filters and details.
- Bounded, signature-verified relay reads and metadata parsing. Relay reads close on navigation into video details.
- Consent-controlled HTTP media loading, explicit source selection, stop/cleanup, initial connection timeout and bounded post-ready stalls.
- Lexical URL filtering, including trailing-dot private-host suffix checks. This is not DNS resolution or redirect protection.

## Verification

Coordinator reran these commands after the independent review fixes:

- `npm test`: 36 tests passed across four files.
- `npm run build`: TypeScript and Vite production build passed.
- `npm audit`: zero reported vulnerabilities, including development dependencies.

Tests include trailing-dot URL rejection, relay cleanup on details navigation, stall deadlines, resumption and timer/listener cleanup.

## Not yet complete

- The P2P adapter deliberately reports WebTorrent unavailable. No real torrent playback has been implemented or verified.
- A real live relay event populating the UI remains unverified.
- Continuous HTTP playback and seeking were not established by the earlier smoke test; see DESKTOP-SMOKE.md.
- Android, iOS and TV compatibility require actual device validation.
- Creator pages, trust-based recommendations, follows and private libraries remain future work.

Passing mocked tests is not proof of live network transfers or physical-device compatibility. Research outputs are separate from the application snapshot and have not yet been approved for publication.
