#!/usr/bin/env python3
"""Bar/beat grid anchored on measured bass drops, each grid point snapped to a
measured low-band onset within +-3 frames when one exists.
Writes audio/beatgrid.json."""
import json, numpy as np, librosa
from pathlib import Path
R = Path(__file__).resolve().parent.parent
FPS = 60000/1001
bass = json.load(open(R/"audio"/"bass.json"))
# anchors: the unmistakable drops (flux > 1.0 or level > .78 after quiet)
anchors = [b["t"] for b in bass if b["flux"] > 1.0 or b["level"] >= 0.78]
k0 = 0.33
ks = np.array([round((t-k0)/2.984) for t in anchors]); ts = np.array(anchors)
b, a = np.polyfit(ks, ts, 1)
# all low-band onsets, lower threshold, for snapping
y, sr = librosa.load(R/"audio"/"reference-mono48k.wav", sr=48000); HOP=128
S=np.abs(librosa.stft(y,n_fft=4096,hop_length=HOP)); f=librosa.fft_frequencies(sr=sr,n_fft=4096)
db=20*np.log10(S[(f>=30)&(f<130)].sum(0)+1e-9); fl=np.maximum(0,np.diff(db,prepend=db[0]))
env=np.convolve(fl,np.ones(6)/6,mode="same")
pk=librosa.util.peak_pick(env,pre_max=12,post_max=12,pre_avg=60,post_avg=30,delta=0.15,wait=20)
kicks=pk*HOP/sr
grid=[]
for bar in range(0, 19):
    for beat in range(4):
        t = a + b*(bar + beat/4)
        if t > 54.2: break
        near = kicks[np.argmin(np.abs(kicks-t))]
        snapped = abs(near-t)*FPS <= 3
        tt = float(near if snapped else t)
        grid.append({"bar": bar, "beat": beat, "t": round(tt,4), "frame": int(round(tt*FPS)), "snapped": bool(snapped)})
json.dump({"bar_seconds": round(b,4), "offset": round(a,4), "anchors": anchors, "grid": grid}, open(R/"audio"/"beatgrid.json","w"), indent=1)
print(f"bar = {b:.4f}s  offset = {a:.4f}s  anchors={len(anchors)}  residuals(frames)=", [round((t-(a+b*k))*FPS,1) for t,k in zip(ts,ks)])
print("downbeats:", [(g['frame'], 'S' if g['snapped'] else '-') for g in grid if g['beat']==0])
print("snapped", sum(g['snapped'] for g in grid), "of", len(grid))
