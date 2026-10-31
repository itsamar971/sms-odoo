import json, os, sys, numpy as np, soundfile as sf
OUT = os.environ.get("DEMO_OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "out"))
tl = json.load(open(os.path.join(OUT, "timeline.json")))
total = float(sys.argv[1])
sr = 24000
track = np.zeros(int((total + 1) * sr), dtype=np.float32)
OFFSET = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
for e in tl:
    a, r = sf.read(os.path.join(OUT, f"seg_{e['key']}.wav"), dtype="float32")
    start = int(max(0, e["t"] + 0.25 + OFFSET) * sr)  # small lead-in after the caption appears
    end = min(len(track), start + len(a))
    track[start:end] += a[: end - start]
peak = np.abs(track).max() or 1
track = track / peak * 0.89
sf.write(os.path.join(OUT, "voice.wav"), track, sr)
print("segments", len(tl), "peak", peak)
