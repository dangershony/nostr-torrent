# Delivery board

Durable Hermes board: `nostr-torrent`. Inspect with `hermes kanban --board nostr-torrent list`.

Tasks are initially parked (blocked) so the gateway cannot launch duplicate writers while the coordinator is implementing. They are not all technical blockers. Complete only with recorded acceptance evidence; unblock one implementation task at a time. No recurring jobs have been enabled.

| Key | Card ID | Task | Owner |
|---|---|---|---|
| NT-01 | `t_3c38df83` | Application foundation and safe catalogue | `nostr-builder` |
| NT-02 | `t_d493216b` | Bounded verified Nostr relay reads | `nostr-builder` |
| NT-03 | `t_4d502037` | Controlled WebRTC playback proof | `nostr-builder` |
| NT-04 | `t_78e79683` | Explicit HTTP playback and transport provenance | `nostr-builder` |
| NT-05 | `t_7760d5fc` | Independent security and desktop browser QA | `nostr-reviewer` |
| NT-06 | `t_00f13510` | Physical Android and iOS playback validation | `nostr-reviewer` |
| NT-07 | `t_0fcd7450` | Creator pages and private local library | `nostr-builder` |
| NT-08 | `t_7611b24b` | Desktop and webOS feasibility | `nostr-builder` |

## Release gates

1. NT-01 → NT-02; NT-03 and NT-04 build on NT-01.
2. NT-05 independently reviews implementation; it never substitutes for physical-device evidence.
3. NT-06 requires NT-03/04 and access to real devices.
4. NT-07 and NT-08 follow playback proof; public release, licence, funding and deployment remain owner decisions.

The application implementation report is in `IMPLEMENTATION.md`. The live board is authoritative for current status, not this task index.
