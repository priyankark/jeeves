# Narration replacement

Status: prepared; waiting for the maker to sign into Clipchamp. The live video still has the original macOS Daniel narration. Do not describe it as a Clipchamp export until the new audio is generated and published.

## Direction

Warm, conversational British English. A calm product walkthrough, with a little wit. Avoid a theatrical butler performance or a hard-sell advertising voice. Start around normal speed and listen to a short preview before rendering the whole script.

Pronunciation: Jev rhymes with “rev”; Jeeves rhymes with “sleeves”. Give each sentence room to breathe. The pause after “waits” should be audible. Do not add music to hide a poor voice.

## Clipchamp workflow

Use **Record & create → Text to speech**. Choose the language and voice, paste one scene's text from `narration.json`, and preview it. Adjust pace in Advanced settings if needed. Save the generated audio. Keep the eight scenes separate so the real footage can be timed to the narration.

Export each scene into a local narration folder with its scene name, such as `intro.mp3` or `03-waiting.mp4`. The renderer accepts WAV, MP3, M4A, MP4, and AIFF. A video export is fine: its audio track is used.

```sh
NARRATION_DIR=/path/to/approved-audio NARRATION_CREDIT="Microsoft Clipchamp, chosen voice" FFMPEG=/path/to/ffmpeg node marketing/video/produce.mjs
FFMPEG=/path/to/ffmpeg node marketing/video/caption.mjs
node marketing/video/check-site.mjs
```

The renderer validates that every scene has an audio file before changing the public assets. It measures each recording, extends the matching shot when needed, and regenerates the caption timing and transcript. Check sentence timing against the speech, especially the long result scene. Do not time-stretch the voice to force it into the old 65-second cut.

Listen to the full exported film for pronunciation, clipped words, awkward pauses, and volume changes. Check the picture and captions with the sound on and off. The final duration should remain roughly one minute; update duration claims if it changes.

Microsoft instructions: https://support.microsoft.com/en-us/clipchamp/how-to-use-the-text-to-speech-feature
