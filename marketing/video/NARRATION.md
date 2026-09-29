# Narration replacement

Status: all eight scenes generated in Microsoft Clipchamp using Andrew Multilingual, English US, neutral emotion, default pitch, and 1x pace. Source clips are in `narration/`. The new cut is approximately 64 seconds.

## Direction

Conversational English. Explain the task on screen in connected sentences. The closing line invites viewers to try the built-in example at getjeeves.app. Avoid a theatrical butler performance or a hard-sell advertising voice. Start around normal speed and listen to a short preview before rendering the whole script.

Pronunciation: Jev rhymes with “rev”; Jeeves rhymes with “sleeves”. Use normal sentence pacing. Avoid a string of short, slogan-like sentences. Do not add music to hide a poor voice.

## Clipchamp workflow

Use **Record & create → Text to speech**. Choose the language and voice, paste one scene's text from `narration.json`, and preview it. Adjust pace in Advanced settings if needed. Save the generated audio. Keep the eight scenes separate so the real footage can be timed to the narration.

Export each scene into a local narration folder with its scene name, such as `intro.mp3` or `03-waiting.mp4`. The renderer accepts WAV, MP3, M4A, MP4, and AIFF. A video export is fine: its audio track is used.

```sh
NARRATION_DIR=marketing/video/narration NARRATION_CREDIT="Microsoft Clipchamp, Andrew Multilingual (English US)" FFMPEG=/path/to/ffmpeg node marketing/video/produce.mjs
FFMPEG=/path/to/ffmpeg node marketing/video/caption.mjs
node marketing/video/check-site.mjs
```

The renderer validates that every scene has an audio file before changing the public assets. It measures each recording, extends the matching shot when needed, and regenerates the caption timing and transcript. Check sentence timing against the speech, especially the long result scene. Do not time-stretch the voice to force it into the old 65-second cut.

Listen to the full exported film for pronunciation, clipped words, awkward pauses, and volume changes. Check the picture and captions with the sound on and off. The final duration should remain roughly one minute; update duration claims if it changes.

Microsoft instructions: https://support.microsoft.com/en-us/clipchamp/how-to-use-the-text-to-speech-feature

## Verification

Local Whisper tiny.en recognition recovered all eight scenes, including Jev and Jeeves, with punctuation and website-formatting differences. Sentence and phrase timings from that recognition are saved in `narration/cues.json`; SHA-256 checks prevent accidentally applying them to different audio. Longer captions are split into readable phrases. The previous closing phrase, “Very good, then”, has been removed. The script introduces Jeeves as an app for productivity workflows.

This automated check establishes wording and approximate caption alignment. It does not establish that a human prefers the voice. A listening review remains useful; no claim of a human listening review is made.
