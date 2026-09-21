#!/usr/bin/env python3
"""Kick/sub-bass onsets only -- the events a viewer feels as 'the drop'.
Writes audio/bass.json: [{t, frame, strength}] sorted by time."""
import json, numpy as np, librosa
from pathlib import Path
R = Path(__file__).resolve().parent.parent
y, sr = librosa.load(R/"audio"/"reference-mono48k.wav", sr=48000)
HOP = 128; FPS = 60000/1001
S = np.abs(librosa.stft(y, n_fft=4096, hop_length=HOP))
f = librosa.fft_frequencies(sr=sr, n_fft=4096)
low = S[(f >= 30) & (f < 130)].sum(axis=0)
db = 20*np.log10(low + 1e-9)
flux = np.maximum(0, np.diff(db, prepend=db[0]))
env = np.convolve(flux, np.ones(6)/6, mode="same")
pk = librosa.util.peak_pick(env, pre_max=40, post_max=40, pre_avg=120, post_avg=60, delta=0.35, wait=60)
lvl = np.convolve(low, np.ones(40)/40, mode="same")
nl = lvl / lvl.max()
out = []
for p in pk:
    t = p*HOP/sr
    after = nl[p:p+int(0.25*sr/HOP)].max()
    out.append({"t": round(t, 4), "frame": int(round(t*FPS)), "flux": round(float(env[p]), 2), "level": round(float(after), 3)})
json.dump(out, open(R/"audio"/"bass.json", "w"), indent=1)
for o in out: print(f"{o['t']:7.3f}  f{o['frame']:5d}  flux {o['flux']:5.2f}  level {o['level']:.2f}  {'#'*int(o['level']*30)}")
print(len(out))
