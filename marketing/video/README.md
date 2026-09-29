# Jeeves launch film

A narrated 1080p walkthrough, approximately 77 seconds. Final files live in `site/media/` so the landing page and GitHub can link to the same video. Five Product Hunt gallery images and a square thumbnail are in `gallery/`.

The footage comes from real Jev (`jev-1.13.0`) and Codex runs in an isolated local workspace using synthetic requests. `live-audit.json` records the three classifications, generator checks, and successful human handoff. Model waiting time and setup/navigation are edited out. The video does not claim an end-to-end runtime or benchmark. The narration uses Microsoft Clipchamp’s Ryan voice (English UK, default pitch and pace); no cloned voice or licensed music is used. No private customer data or credentials appear in the footage.

## Reproduce

Requires the repository dependencies, Chrome, FFmpeg with libass and drawtext, macOS `afinfo`, and approved narration exports. The eight Clipchamp audio clips and aligned caption cues are in `narration/`. The script and Clipchamp steps are in [NARRATION.md](NARRATION.md).

1. Start a separate Jeeves engine on port 4340 with a temporary workspace and configured TypeSafe/Codex services. Do not record personal chats or provider settings.
2. Run `node --import tsx marketing/video/audit-live.mjs` against that engine. The script saves progress; remove the old audit JSON if starting with a new workspace. It leaves the synthetic missing-information case waiting.
3. Run `node marketing/video/record.mjs`. It inspects the recorded urgent case, records the waiting form, types a clarification, submits it, waits for real completion, and inspects the actual output/export UI. Raw video and shot timing are saved under `/tmp/jeeves-film`.
4. Serve `site/` on port 4341. Set `NARRATION_DIR=marketing/video/narration` and `NARRATION_CREDIT="Microsoft Clipchamp, Ryan (English UK)"`. Run `node marketing/video/produce.mjs`, then `node marketing/video/caption.mjs`. The latter burns captions into the MP4 and normalizes narration. The uncaptioned master remains in `/tmp/jeeves-film/master.mp4`.
5. Run `node marketing/video/gallery.mjs` and `node marketing/video/check-site.mjs`.

The separate VTT and HTML transcript support reuse and accessibility. Product Hunt requires a non-private YouTube upload rather than a direct MP4; upload the finished film through the maker account when ready. The site hosts the MP4 directly.

## Observed limitations

The live sample is three requests, not a general accuracy claim. A complex generated workflow timed out once at the existing 120-second limit and succeeded on an explicit retry. The generator now receives instructions to omit unrelated default fields; a latency improvement has not been established. The app test suite covers low-confidence review and resuming the user-input branch without repeating the earlier judgment.
