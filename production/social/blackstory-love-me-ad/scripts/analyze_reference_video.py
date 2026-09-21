#!/usr/bin/env python3
"""Analyze the reference TikTok's VIDEO track: cut points, motion energy, luma.

Decodes the reference to a small grayscale raw stream and computes per-frame
differences. A cut is a frame whose difference from its predecessor is a strong
local outlier. Output: reference/video-analysis.json
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "reference" / "ambnt-7670347350115634462.mp4"
OUT = ROOT / "reference" / "video-analysis.json"
FPS = 2997 / 50.0          # 59.94
W, H = 64, 114             # downscaled analysis resolution

raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", str(SRC),
     "-vf", f"scale={W}:{H}:flags=area,format=gray",
     "-f", "rawvideo", "-pix_fmt", "gray", "-"],
    capture_output=True, check=True).stdout

n = len(raw) // (W * H)
f = np.frombuffer(raw, np.uint8)[: n * W * H].reshape(n, H, W).astype(np.float32) / 255.0
print(f"decoded {n} frames @ {W}x{H}", file=sys.stderr)

luma = f.mean(axis=(1, 2))
diff = np.zeros(n)
diff[1:] = np.abs(f[1:] - f[:-1]).mean(axis=(1, 2))

# Cut detection: difference must be a strong outlier vs its local neighbourhood,
# which keeps fast camera motion from registering as a cut.
win = 15
cuts = []
med = np.median(diff[diff > 0])
for i in range(2, n):
    lo, hi = max(1, i - win), min(n, i + win + 1)
    local = np.concatenate([diff[lo:i], diff[i + 1:hi]])
    if local.size == 0:
        continue
    lm = np.median(local)
    if diff[i] > max(0.045, 3.0 * lm, 1.8 * med) and (not cuts or i - cuts[-1] >= 4):
        cuts.append(i)

print(f"{len(cuts)} cuts", file=sys.stderr)
json.dump({
    "source": SRC.name, "fps": FPS, "frames": n, "duration": n / FPS,
    "cut_frames": cuts,
    "cut_times": [round(c / FPS, 4) for c in cuts],
    "luma": [round(float(x), 5) for x in luma],
    "motion": [round(float(x), 5) for x in diff],
}, open(OUT, "w"), indent=1)
print(f"wrote {OUT}", file=sys.stderr)
