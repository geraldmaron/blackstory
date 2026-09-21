#!/usr/bin/env python3
"""Programmatic QA of a render: blank frames, cut-to-marker alignment, audio.
usage: qa_render.py RENDER.mp4 SYNCCHECK.mp4  -> writes renders/<name>-qa.json"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parent.parent
vid, sync = sys.argv[1], sys.argv[2]
FPS = 60000 / 1001
W, H = 90, 160
raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", vid, "-vf",
    f"scale={W}:{H}:flags=area,format=gray", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
n = len(raw) // (W * H)
f = np.frombuffer(raw, np.uint8)[:n*W*H].reshape(n, H, W).astype(np.float32) / 255
luma, std = f.mean(axis=(1, 2)), f.std(axis=(1, 2))
diff = np.zeros(n); diff[1:] = np.abs(f[1:] - f[:-1]).mean(axis=(1, 2))
# "blank" = near-uniform frame (loading state, empty image box, black)
blank = [int(i) for i in np.where(std < 0.012)[0]]
# intended cuts come from the shot list
shots = json.loads(subprocess.run(["node", "-e",
  "import('./shots.mjs').then(m=>console.log(JSON.stringify(m.SHOTS.filter(s=>s.name!=='brand-fg').map(s=>[s.name,s.in]))))"],
  cwd=ROOT/"project", capture_output=True, text=True, check=True).stdout)
markers = json.load(open(ROOT/"audio"/"markers.json"))["markers"]
cuts = []
for name, fin in shots[1:]:
    # the measured cut is the largest frame difference within +-3 of intended
    lo, hi = max(1, fin-3), min(n, fin+4)
    got = lo + int(np.argmax(diff[lo:hi]))
    near = min(markers, key=lambda m: abs(m["frame"] - fin))
    cuts.append({"shot": name, "intended": fin, "measured": got, "err_frames": got-fin,
                 "diff": round(float(diff[got]), 4), "nearest_marker": f'{near["kind"]} {near["t"]}s',
                 "marker_offset_frames": fin - near["frame"]})
# audio
a = subprocess.run(["ffmpeg", "-nostdin", "-v", "info", "-i", sync, "-af", "ebur128=peak=true",
                    "-f", "null", "-"], capture_output=True, text=True).stderr
summ = a[a.rfind("Summary:"):]
pk = subprocess.run(["ffmpeg","-nostdin","-v","error","-i",sync,"-t","0.05","-f","s16le","-ac","1","-"],capture_output=True).stdout
out = {"render": Path(vid).name, "frames": n, "duration_s": round(n/FPS, 4),
       "blank_frames": blank, "cuts": cuts,
       "cut_errors_nonzero": [c for c in cuts if c["err_frames"] != 0],
       "ebur128_summary": " ".join(summ.split())}
Path(ROOT/"renders"/(Path(vid).stem + "-qa.json")).write_text(json.dumps(out, indent=1))
print(f"frames={n} blank={len(blank)} {blank[:20]}")
print(f"cuts checked={len(cuts)} off-grid={len(out['cut_errors_nonzero'])}")
for c in out["cut_errors_nonzero"]: print("  ", c)
print("marker offsets (cut frame - nearest marker frame):",
      sorted(set(c["marker_offset_frames"] for c in cuts)))
print(out["ebur128_summary"])
