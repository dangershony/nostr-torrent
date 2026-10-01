# nostr-torrent engineering rules

Read docs/PROJECT.md before work. It is the scope and acceptance authority.

- Work only in this repository; keep it private. No paid services, public deployments, public Nostr publishing, credentials, or user watch history.
- React + TypeScript; separate catalogue/parser, relay, playback adapter, and UI layers.
- Use strict TDD: run a failing behavioural test, implement the smallest slice, run tests, repeat. Record verification commands and genuine results.
- Treat relay metadata and URLs as hostile. Bound payloads/subscriptions, verify signatures, deduplicate, clean up resources. No raw HTML rendering or private-key entry.
- Development fixtures must be visibly labelled; never call fixtures live relay results.
- P2P requires explicit consent about IP exposure/upload bandwidth. Never silently fall back to HTTP. Report actual active transport.
- Whole-file SHA-256 and BitTorrent info hashes are distinct. App-specific NIP linkage conventions must be documented as such.
- Tests using mocks prove logic, not real P2P transfer or actual device compatibility. Record these separately.
- Do not claim Android/iOS/TV compatibility without physical-device evidence.
- Do not commit/push without an independent review. Do not merge, change repository visibility, or enable unattended recurring tasks.
