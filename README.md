# nostr-torrent

An experimental video client: Nostr for signed catalogue metadata and controlled WebTorrent browser-to-browser video delivery.

**Current prototype:** browsing/search, signature-verified relay-read code, consent-controlled HTTP playback, and real WebRTC torrent streaming with an explicitly controlled seed. Local fixtures are labelled, not live relay results. There is no always-on public P2P demo seed.

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
- [Controlled WebTorrent demo, limits, audit blocker and real P2P evidence](docs/WEBTORRENT.md)
- [Video playback, demo provenance and real-browser verification](docs/VIDEO-PLAYBACK.md)
- [Implementation and verified limitations](docs/IMPLEMENTATION.md)
- [Task index](docs/TASKS.md)
- [Earlier desktop smoke evidence](docs/DESKTOP-SMOKE.md)
- [Physical-device validation checklist](docs/DEVICE-VALIDATION.md)

A Nostr signature establishes the signing key, not the truth of a claim or the authenticity of a film. Real P2P transfer is verified in local desktop Chromium; physical-device compatibility and public swarm availability remain unverified. The dependency audit currently reports four high-severity findings; see the WebTorrent notes before deployment.
