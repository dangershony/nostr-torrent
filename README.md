# nostr-torrent

An experimental video client: Nostr for signed catalogue metadata and planned trusted discovery; torrents for planned peer-to-peer video delivery.

**Current prototype:** browsing/search, signature-verified relay-read code and consent-controlled HTTP playback. **WebTorrent playback is not implemented yet.** Local fixtures are explicitly labelled, not live relay results.

## Run locally

Requires Node.js 22.12 or later and npm.

```sh
npm ci
npm test
npm run build
npm run dev -- --port 5173 --strictPort
```

Open http://127.0.0.1:5173. The development server binds to loopback only. No account or private key is needed. Relay connections and media loading require explicit user actions. Unavailable P2P never silently falls back to HTTP.

## Documentation

- [Scope and roadmap](docs/PROJECT.md)
- [Video playback, demo provenance and real-browser verification](docs/VIDEO-PLAYBACK.md)
- [Implementation and verified limitations](docs/IMPLEMENTATION.md)
- [Task index](docs/TASKS.md)
- [Earlier desktop smoke evidence](docs/DESKTOP-SMOKE.md)
- [Physical-device validation checklist](docs/DEVICE-VALIDATION.md)

A Nostr signature establishes the signing key, not the truth of a claim or the authenticity of a film. Physical-device compatibility and real P2P transfer remain acceptance gates, not existing capabilities.
