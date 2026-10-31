import json, os, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("DEMO_OUT", os.path.join(HERE, "out"))
os.makedirs(OUT, exist_ok=True)
MODELS = os.environ.get("KOKORO_DIR", os.path.join(HERE, "models"))
from kokoro_onnx import Kokoro
k = Kokoro(os.path.join(MODELS, "kokoro-v1.0.int8.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))
segs = json.load(open(os.path.join(HERE, "narration.json")))
out = {}
for key, cap, text in segs:
    s, sr = k.create(text, voice="hm_omega", speed=0.97, lang="en-us")
    sf.write(os.path.join(OUT, f"seg_{key}.wav"), s, sr)
    out[key] = {"caption": cap, "dur": round(len(s)/sr, 3)}
    print(key, out[key]["dur"], flush=True)
json.dump(out, open(os.path.join(OUT, "segments.json"), "w"), indent=1)
print("TOTAL", sum(v["dur"] for v in out.values()))
