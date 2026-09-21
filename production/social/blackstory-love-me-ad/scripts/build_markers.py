#!/usr/bin/env python3
"""Derive the authoritative marker map from the reference audio.

Markers are measured, never inferred from BPM. Three detectors:
  GAP  - the edit-audio's engineered silences (hardest cut points in the track)
  HIT  - sub/low transient attacks (the DAW's HIT / BOOM / drop events)
  VOX  - merged vocal phrases, with sustain length for the held "meee" notes
Everything is snapped to the 59.94fps frame grid the render uses.

Output: audio/markers.json
"""
import json, sys
from pathlib import Path
import numpy as np
import librosa

ROOT = Path(__file__).resolve().parent.parent
FPS = 2997 / 50.0
SR = 48000
HOP = 128                                  # 2.67 ms

y, sr = librosa.load(ROOT / "audio" / "reference-mono48k.wav", sr=SR, mono=True)
dur = len(y) / sr
T = lambda f: f * HOP / sr
FR = lambda s: int(round(s * FPS))

S = np.abs(librosa.stft(y, n_fft=1024, hop_length=HOP))
freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)
rms = librosa.feature.rms(S=S, frame_length=1024, hop_length=HOP)[0]
Hs, Ps = librosa.decompose.hpss(S, margin=3.0)
bandE = lambda Sx, lo, hi: Sx[(freqs >= lo) & (freqs < hi)].mean(axis=0)
sub = bandE(S, 20, 110)
voc = bandE(Hs, 250, 3500)
air = bandE(S, 6000, 16000)
nrm = lambda x: (x - x.min()) / (x.max() - x.min() + 1e-12)
smooth = lambda x, w: np.convolve(x, np.hanning(w) / np.hanning(w).sum(), mode="same")

rn, sn, vn, an = nrm(rms), nrm(sub), smooth(nrm(voc), 31), smooth(nrm(air), 41)
M = []

# ---- GAP: engineered silences ------------------------------------------
quiet = rn < 0.10
i = 0
while i < len(quiet):
    if quiet[i]:
        j = i
        while j + 1 < len(quiet) and quiet[j + 1]:
            j += 1
        if T(j) - T(i) >= 0.06 and T(i) > 0.3 and T(j) < dur - 0.3:
            M.append({"kind": "GAP", "t": round(T(i), 4), "t_end": round(T(j), 4),
                      "dur": round(T(j) - T(i), 4), "strength": 1.0})
        i = j + 1
    else:
        i += 1

# ---- HIT: sub-band transient attacks -----------------------------------
d = np.zeros_like(sn); d[1:] = np.diff(smooth(sn, 9))
pk = int(0.09 * sr / HOP)
last = -99
for k in range(pk, len(d) - pk):
    if d[k] > 0.020 and d[k] == d[k - pk:k + pk].max() and T(k) - last > 0.20:
        # backtrack to the true attack foot
        b = k
        while b > 0 and sn[b - 1] < sn[b] and k - b < int(0.05 * sr / HOP):
            b -= 1
        M.append({"kind": "HIT", "t": round(T(b), 4),
                  "strength": round(float(sn[k:k + pk].max()), 3)})
        last = T(k)

# ---- VOX: merged vocal phrases -----------------------------------------
act = vn > 0.26
segs, i = [], 0
while i < len(act):
    if act[i]:
        j = i
        while j + 1 < len(act) and act[j + 1]:
            j += 1
        segs.append([i, j]); i = j + 1
    else:
        i += 1
merged = []
for s in segs:
    if merged and T(s[0]) - T(merged[-1][1]) < 0.22:
        merged[-1][1] = s[1]
    else:
        merged.append(s)
for (i, j) in merged:
    if T(j) - T(i) < 0.18:
        continue
    a, b = int(T(i) * sr), int(min(T(j) + .02, dur) * sr)
    seg = y[a:b]; sustain = 0.0; f0med = None
    if len(seg) > 1024:
        f0, _, _ = librosa.pyin(seg, fmin=80, fmax=900, sr=sr,
                                frame_length=2048, hop_length=HOP)
        g = f0[~np.isnan(f0)]
        if g.size:
            f0med = float(np.median(g))
            steady = np.abs(1200 * np.log2(np.where(np.isnan(f0), f0med, f0) / f0med)) < 110
            run = best = 0
            for s_ in steady:
                run = run + 1 if s_ else 0
                best = max(best, run)
            sustain = best * HOP / sr
    M.append({"kind": "VOX", "t": round(T(i), 4), "t_end": round(T(j), 4),
              "dur": round(T(j) - T(i), 4), "sustain": round(sustain, 3),
              "f0": round(f0med, 1) if f0med else None,
              "strength": round(float(vn[i:j + 1].max()), 3)})

M.sort(key=lambda m: m["t"])
for m in M:
    m["frame"] = FR(m["t"])

env = {"t": [], "rms": [], "sub": [], "vocal": [], "air": []}
for k in range(0, len(rn), 8):
    env["t"].append(round(T(k), 4))
    env["rms"].append(round(float(rn[k]), 4))
    env["sub"].append(round(float(sn[k]), 4))
    env["vocal"].append(round(float(vn[k]), 4))
    env["air"].append(round(float(an[k]), 4))

json.dump({"source": "ambnt-7670347350115634462.mp4", "fps": FPS,
           "duration": round(dur, 4), "total_frames": FR(dur),
           "bar_seconds": 3.0, "tempo_bpm": 80.0,
           "tempo_note": "80 BPM measured from 3.000s gap spacing; librosa's "
                         "123.6 estimate is an octave error. Markers are measured, "
                         "not derived from this tempo.",
           "markers": M, "envelope": env}, open(ROOT / "audio" / "markers.json", "w"), indent=1)

for k in ("GAP", "HIT", "VOX"):
    print(f"{k}: {sum(1 for m in M if m['kind']==k)}", file=sys.stderr)
print(f"total {len(M)} markers -> audio/markers.json", file=sys.stderr)
