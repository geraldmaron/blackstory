#!/usr/bin/env python3
"""Analyze the reference edit-audio and emit the authoritative marker map.

Everything downstream (shot boundaries, transition frames, the render) is driven
by audio/markers.json produced here. Nothing in the edit is derived from BPM
alone -- markers come from measured onsets, RMS, pitch and spectral motion.

Output: audio/analysis.json  (dense curves)
        audio/markers.json   (discrete, named markers used by the edit)
"""
import json, sys
from pathlib import Path
import numpy as np
import librosa

ROOT = Path(__file__).resolve().parent.parent
WAV = ROOT / "audio" / "reference-mono48k.wav"
FPS = 2997 / 50.0
SR = 48000
HOP = 256                      # 5.33 ms -- finer than one video frame (16.7 ms)

y, sr = librosa.load(WAV, sr=SR, mono=True)
dur = len(y) / sr
t = lambda fr: fr * HOP / sr
print(f"loaded {dur:.4f}s @ {sr}Hz", file=sys.stderr)

# ---- where does the audio actually start? -------------------------------
amp = np.abs(y)
thr = amp.max() * 0.002
nz = np.nonzero(amp > thr)[0]
a_start, a_end = nz[0] / sr, nz[-1] / sr

# ---- core curves ---------------------------------------------------------
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=HOP))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
rms = librosa.feature.rms(S=S, frame_length=2048, hop_length=HOP)[0]
cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
flat = librosa.feature.spectral_flatness(S=S)[0]
onset_env = librosa.onset.onset_strength(S=librosa.power_to_db(S**2), sr=sr, hop_length=HOP)

# harmonic/percussive split: vocals ride the harmonic part, hits the percussive
Hs, Ps = librosa.decompose.hpss(S, margin=3.0)
h_rms = librosa.feature.rms(S=Hs, hop_length=HOP)[0]
p_rms = librosa.feature.rms(S=Ps, hop_length=HOP)[0]

def band(Sx, lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    return Sx[m].mean(axis=0)

sub_e   = band(S, 20, 90)       # sub / 808
low_e   = band(S, 90, 250)      # bass, kick body
voc_e   = band(Hs, 250, 3500)   # vocal formant range (harmonic only)
air_e   = band(S, 6000, 16000)  # hats, risers, air

nrm = lambda x: (x - x.min()) / (x.max() - x.min() + 1e-12)

# ---- tempo / beats (recorded for reference only, never used as the grid) --
tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=HOP, trim=False)
tempo = float(np.atleast_1d(tempo)[0])

# ---- transient onsets ----------------------------------------------------
on_f = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=HOP,
                                  backtrack=True, units="frames",
                                  pre_max=12, post_max=12, pre_avg=40, post_avg=40,
                                  delta=0.18, wait=8)
onsets = []
for f in on_f:
    w = slice(max(0, f - 3), f + 12)
    onsets.append({
        "t": round(t(f), 4),
        "frame": int(round(t(f) * FPS)),
        "strength": round(float(onset_env[f]), 3),
        "sub": round(float(sub_e[w].mean()), 5),
        "air": round(float(air_e[w].mean()), 5),
        "perc": round(float(p_rms[w].mean()), 5),
    })

# ---- vocal activity ("love me" entrances) --------------------------------
vn = nrm(voc_e)
vsm = np.convolve(vn, np.hanning(21) / np.hanning(21).sum(), mode="same")
vthr = 0.30
active = vsm > vthr
segs = []
i = 0
while i < len(active):
    if active[i]:
        j = i
        while j + 1 < len(active) and active[j + 1]:
            j += 1
        if t(j) - t(i) > 0.10:
            segs.append((i, j))
        i = j + 1
    else:
        i += 1

# f0 on each vocal segment -> identifies the long sustained "meeee" holds
vocals = []
for (i, j) in segs:
    s0, s1 = int(t(i) * sr), int(min(t(j) + 0.02, dur) * sr)
    seg = y[s0:s1]
    sustain = 0.0
    f0med = None
    if len(seg) > 2048:
        f0, vflag, _ = librosa.pyin(seg, fmin=80, fmax=1000, sr=sr,
                                    frame_length=2048, hop_length=HOP)
        good = f0[~np.isnan(f0)]
        if good.size:
            f0med = float(np.median(good))
            # longest run where pitch stays within a semitone of the median
            steady = np.abs(1200 * np.log2(np.where(np.isnan(f0), f0med, f0) / f0med)) < 100
            run = best = 0
            for s in steady:
                run = run + 1 if s else 0
                best = max(best, run)
            sustain = best * HOP / sr
    vocals.append({
        "start": round(t(i), 4), "end": round(t(j), 4),
        "dur": round(t(j) - t(i), 4),
        "start_frame": int(round(t(i) * FPS)),
        "peak": round(float(vsm[i:j + 1].max()), 3),
        "f0": round(f0med, 1) if f0med else None,
        "sustain": round(sustain, 3),
    })

# ---- risers: sustained climb in air energy + centroid ---------------------
win = int(0.75 * sr / HOP)
air_s = np.convolve(nrm(air_e), np.hanning(31) / np.hanning(31).sum(), mode="same")
slope = np.zeros_like(air_s)
slope[win:] = air_s[win:] - air_s[:-win]
risers = []
rthr = 0.22
k = 0
while k < len(slope):
    if slope[k] > rthr:
        m = k
        while m + 1 < len(slope) and slope[m + 1] > rthr * 0.5:
            m += 1
        if t(m) - t(k) > 0.4:
            risers.append({"start": round(t(k) - 0.75, 4), "peak": round(t(m), 4),
                           "peak_frame": int(round(t(m) * FPS))})
        k = m + 1
    else:
        k += 1

# ---- drops: sub/rms jump following a quieter bar --------------------------
rn = nrm(rms)
drops = []
look = int(1.2 * sr / HOP)
for o in onsets:
    f = int(o["t"] * sr / HOP)
    if f < look or f + look >= len(rn):
        continue
    before, after = rn[f - look:f].mean(), rn[f:f + look].mean()
    if after - before > 0.16 and o["sub"] > np.percentile(sub_e, 75):
        if not drops or o["t"] - drops[-1]["t"] > 2.0:
            drops.append({"t": o["t"], "frame": o["frame"],
                          "lift": round(float(after - before), 3)})

# ---- pauses / breaths -----------------------------------------------------
pauses = []
q = rn < 0.12
i = 0
while i < len(q):
    if q[i]:
        j = i
        while j + 1 < len(q) and q[j + 1]:
            j += 1
        if t(j) - t(i) > 0.18:
            pauses.append({"start": round(t(i), 4), "end": round(t(j), 4),
                           "dur": round(t(j) - t(i), 4)})
        i = j + 1
    else:
        i += 1

# ---- structural segmentation ---------------------------------------------
mfcc = librosa.feature.mfcc(S=librosa.power_to_db(S**2), n_mfcc=13)
bounds = librosa.segment.agglomerative(mfcc, 9)
sections = [round(t(int(b)), 4) for b in bounds]

json.dump({
    "source": "ambnt-7670347350115634462.mp4", "sr": sr, "hop": HOP, "fps": FPS,
    "duration": round(dur, 4),
    "audio_start": round(a_start, 4), "audio_end": round(a_end, 4),
    "tempo_estimate": round(tempo, 2),
    "beat_times": [round(x, 4) for x in librosa.frames_to_time(beats, sr=sr, hop_length=HOP)],
    "curves": {
        "t": [round(t(i), 4) for i in range(0, len(rms), 4)],
        "rms": [round(float(x), 5) for x in rms[::4]],
        "sub": [round(float(x), 5) for x in sub_e[::4]],
        "vocal": [round(float(x), 5) for x in vsm[::4]],
        "air": [round(float(x), 5) for x in air_s[::4]],
        "centroid": [round(float(x), 1) for x in cent[::4]],
        "percussive": [round(float(x), 5) for x in p_rms[::4]],
    },
    "onsets": onsets, "vocals": vocals, "risers": risers,
    "drops": drops, "pauses": pauses, "sections": sections,
}, open(ROOT / "audio" / "analysis.json", "w"), indent=1)

print(f"audio_start={a_start:.4f} audio_end={a_end:.4f} tempo~{tempo:.1f}", file=sys.stderr)
print(f"onsets={len(onsets)} vocals={len(vocals)} risers={len(risers)} "
      f"drops={len(drops)} pauses={len(pauses)}", file=sys.stderr)
print(f"sections={sections}", file=sys.stderr)
