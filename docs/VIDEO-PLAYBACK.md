# Video playback: first usable HTTP demo

Verified 2026-10-02 on Linux, Node 26.8.1, Playwright 1.63.0 and isolated headless Chromium 151.0.7922.173. **This is HTTP playback, not WebTorrent.** No deployment, commit or push was made.

## Watch

Run `npm ci && npm run dev -- --port 5173 --strictPort`, open http://127.0.0.1:5173, choose **Sintel · HTTP demo**, check the HTTP connection consent box and press **Play via HTTP**. The player moves into view and starts. Native controls handle pause/resume and seeking; Replay restarts the selected source. Stop, leaving details, or revoking consent clears the media source. No media request happens merely from opening details or checking consent.

The other five fixtures are fictional, have no video attached, and are now labelled accordingly. Their details direct viewers to Sintel. No automatic fallback is used. Browser-policy rejection explains how to use native Play; a load/decode failure or the existing 20-second timeout offers retry. P2P remains explicitly unavailable.

## Reproduction and root cause

`CHROMIUM_PATH=/usr/bin/chromium node scripts/repro-video.mjs` runs the same assertion against the local dev server before and after the fix. Override `BASE_URL` to inspect another build. The script logs actual media state/network responses, then adds a diagnostic Play button to distinguish decoding problems from the missing application Play action.

- Original local build and the unchanged public site (`BASE_URL=https://dangershony.github.io/nostr-torrent/`): after consent + **Load selected source** and 12 seconds, `paused=true`, `currentTime=0`, `readyState=4`, dimensions 854×480, no MediaError. The assertion failed as intended. A separate user-gesture `video.play()` advanced the public site's video to 2.439644 seconds. The original button loaded but never called `play()`.
- The host returned HTTP 206 range responses. Some range requests were cancelled with `net::ERR_ABORTED`; those were not decoding failures and did not prevent playback. `canPlayType` reported `probably` for H.264/AAC MP4.
- Fixed local repro: `paused=false`, `currentTime=11.778222` after the same wait, `readyState=4`; assertion passed.
- A separate browser regression initially failed on the narrow viewport: the playing video had viewport intersection ratio 0. Bringing the video into view on Play fixed it; the test now requires at least 90% visible without test-driven scrolling.

Unit tests were run red before the primary Play behavior, pause/end status updates and blocked-play handling were implemented. The browser availability-label test also ran red before the labels were added. Existing consent, timeout, cleanup and no-fallback tests remain green.

## Source, codecs and permission

Unmodified external trailer, not the full film or a bundled asset:

- Media: https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4
- Attribution: **© copyright Blender Foundation | durian.blender.org** (also shown in the UI).
- Creator's sharing terms: https://durian.blender.org/sharing/
- License: **Creative Commons Attribution 3.0**, https://creativecommons.org/licenses/by/3.0/

The creator's sharing page was retrieved successfully with curl and states that Durian's published project data is CC BY 3.0, permitting redistribution with attribution. Logos/trademarks are excluded. No media was modified or rehosted. The existing creator host worked repeatedly, so a replacement hosted asset was unnecessary.

Actual probe:

```sh
ffprobe -v error -show_entries stream=codec_name,codec_type,width,height \
  -show_entries format=duration,size -of json \
  https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4
```

Result: H.264 video, 854×480; AAC audio; duration 52.208333 seconds; 4,372,373 bytes. HEAD returned `video/mp4` and `Accept-Ranges: bytes`.

## Repeat verification

```sh
npm ci
npm run typecheck
npm test
npm run build
npm audit
# Use an installed Chromium (the path below was used for the recorded run):
CHROMIUM_PATH=/usr/bin/chromium npm run test:video
# Alternatively install Playwright Chromium, then omit CHROMIUM_PATH:
# npx playwright install chromium
# npm run test:video
```

The browser suite builds and serves the production app locally under `/nostr-torrent/`, matching the Pages base path. It uses fresh browser contexts, not the user's profile. Real-playback tests access Blender's host; they do not intercept or synthesize media.

Results from the final full run:

| Check | Result |
|---|---|
| Fresh `npm ci`, typecheck (including browser tests), build | Passed |
| Unit tests | 41 passed in 4 files |
| Browser tests | 6 passed (3 scenarios × 2 viewport sizes) |
| `npm audit` | 0 vulnerabilities |
| `git diff --check` | Passed |
| Desktop 1440×1000 | Time 1.610130, further advancement asserted, seek to 20 → 20.724361; 171 decoded frames |
| Narrow 390×844 | Time 1.628971, further advancement asserted, seek to 20 → 20.740472; 171 decoded frames |

Both real-playback runs returned HTTP 206, `paused=false`, `readyState=4`, 854×480 video and no page exceptions. Tests also check no pre-consent media requests, player visibility, no horizontal overflow, pause, stop/restart, revoking consent and back navigation. A separately labelled **simulated 503** test proves retry/no-fallback behavior; it is not evidence of a real host outage. Browser-policy rejection is unit-tested with a rejected Play promise, not claimed as an observed browser-policy failure.

Screenshots (generated, gitignored) were visually inspected: they contain an actual Sintel film frame and the HTTP transport label, not a poster:

- `test-results/video.pw.ts-real-HTTP-demo-5e0b8-d-clears-only-after-consent-desktop/playing.png`
- `test-results/video.pw.ts-real-HTTP-demo-5e0b8-d-clears-only-after-consent-narrow/playing.png`

## Limits

External availability is not guaranteed; offline playback is not supported. Seeking was exercised through the real media element's `currentTime` API, not a physical touch scrub. Headless desktop/narrow-viewport tests do **not** establish Android, iOS, Safari, TV or audible speaker-output compatibility. No real torrent engine, peer transfer or controlled WebRTC seed was implemented or verified. Public Pages remains unchanged until reviewed and deployed separately.
