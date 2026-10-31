# Demo walkthrough video

`brightloop-sms-walkthrough.mp4` is a captioned walkthrough with an Indian-English male voiceover (7 min 50 s).
It was recorded from the production build with fresh seed data.

## Regenerate it

```bash
# 1. Voice: Kokoro TTS (offline, CPU), voice "hm_omega"
pip install kokoro-onnx soundfile numpy
mkdir -p demo/models && cd demo/models
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
cd ../.. && python3 demo/synth.py            # -> demo/out/seg_*.wav + segments.json

# 2. Screen recording, paced by the narration lengths
npm run build && npm start &                 # fresh in-memory data
node demo/record.js                          # -> demo/out/video/*.webm + timeline.json

# 3. Mix the voice at the logged timestamps and mux
python3 demo/mix.py <video-seconds>          # -> demo/out/voice.wav
ffmpeg -i demo/out/video/*.webm -i demo/out/voice.wav -c:v libx264 -crf 23 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -shortest -movflags +faststart demo/brightloop-sms-walkthrough.mp4
```

The narration text and the matching on-screen captions are in `narration.json`.
