# Courtyard audio

Ten real field-recording excerpts, in twenty mono AAC/Opus files, total 648,997 bytes including the manifest, credits and source inventory (1,800,000-byte cap). Clips last 2–22.5 seconds. The traffic bed has a 1.5-second PCM tail/head crossfade. AAC uses 22.05 kHz / 32 kbps; Opus uses its supported 24 kHz input / 32 kbps. WebAudio resamples decoded buffers to the device context rate.

## Provenance and reproduction

- `public/audio/SOURCES.md`: each shipped file, author, Commons URL, licence URL and adaptation.
- `public/audio/credits.json`: the same credits, loaded independently by the existing About modal.
- `provenance.json`: Commons API licence metadata, including API request URLs and check dates.
- `npm run audio:build`: fetch originals into ignored `artifacts/audio-source/`, check licences and build derivatives using the `ffmpeg-static` development dependency. Download retries accommodate Commons rate limits.
- `npm run audio:validate`: verify inventory, all file sizes, actual decoding, mono channels, encoded durations, iOS-compatible format, approved licence and per-file SOURCES entries; reject unlisted shipped files.
- `npm run verify:audio`: run an isolated Vite / Playwright fixture with actual WebAudio. No screenshots or licensed assets are required.

Children are Berlin playground walla, with two excerpts and distance filtering; Russian speech and completely unintelligible speech are not claimed. Bird recordings are house sparrows. The door is a closet-door slam adapted as a distant entrance; the window is a hopper window. All original sources are CC0, CC BY or public domain; no BY-SA/NC or licensed stock recordings ship.

## Mixer and lifecycle

The existing playing-state callback requests ambience; the mixer module and recordings load only while playing, audible, visible and unlocked. Optional JSON/download/decode failures preserve gameplay and the filtered air bed. Files are requested only from the manifest; unsupported formats are skipped, and decode failure tries the next declared format. A failed manifest is not repeatedly probed. Muting, hiding or suspending stops every source and its owned graph and cancels loading. A later unlock/visible state resumes using cached buffers; disposal aborts loading, disconnects the bus and removes listeners.

Traffic and filtered noise reserve two voices. Random one-shots add distance gain/lowpass filtering, slight stereo pan and ±3% playback variation. Fixed sunset intervals leave quiet gaps; the runtime uses `Math.random`, while tests inject a seeded generator. Full profile caps ambience at eight voices, phones at four, with half the one-shot rate. A live profile downgrade trims existing one-shots. Audio runs a 500 ms control timer, with no render-loop callback or added draw calls. The shared wind singleton is imported read-only: strength raises air gain/cutoff and reduces exposed bird activity. Hits duck the ambience bus to 28% and restore it over 150 ms; both recorded and synthetic ambience pass through the existing master volume/compressor.

Integration hooks outside the audio files: two changed lines in `src/main.js` (live profile query, disposal) and three added lines in `src/ui/modalFlow.js` (optional audio credits fetch). No lighting, present-pass, touch, reticle or HUD CSS files were edited.

## Evidence and limits

`browser.json` records shipped-asset validation, actual Chrome decoding of both formats for all ten clips, zero recording requests before play / while muted, voice limits, one-shot completion, visibility pause/resume, context suspend/gesture unlock, strike ducking, master mute and disposal. Control-tick CPU is measured separately from rendering and physics; this is not a complete game-frame CPU/GPU benchmark. Audio adds zero draw calls.

The installed Windows Playwright WebKit build reports AAC support and no Opus support, but exposes no AudioContext. Its graceful no-audio path is checked and its playback tests are explicitly skipped. Real iPhone/iPad audio output and unlock are not verified here; AAC delivery and gesture-synchronous `resume()` provide the required compatibility path.

The Pages production build uses `COVERHIT_BASE=/CoverHit/`. It includes the audio directory and a separate lazy ambience chunk, with no Envato carpet or yard stock files. Tests include scheduler replay, phone density/voice budget, wind activity, distance filtering, safe format negotiation, unsupported/decode fallback, hidden/muted loads, immediate unmute after abort, live profile trimming, finished-node cleanup and context disposal.

Final unit validation: 54 files / 375 tests passed with `npm test -- --maxWorkers=1 --testTimeout=60000`. An earlier ordinary `npm test` passed 373 tests before the final two lifecycle cases were added; a later concurrent rerun hit unrelated geometry/physics timeouts on the busy shared machine. The final rerun changes worker/timeout settings only, with every assertion retained. `COVERHIT_BASE=/CoverHit/ npm run build` passes; the existing large-chunk warning remains. A transient output-file open failure was resolved by rerunning the asset build. Audio validation and browser QA pass independently.
