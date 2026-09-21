#!/usr/bin/env python3
"""Contact sheet of specific frames from a render, for review.

usage: sheet.py VIDEO OUT.png FRAME [FRAME ...] [--cols N] [--w PX]
"""
import subprocess, sys, tempfile, os
args = sys.argv[1:]
cols, w = None, 180
if "--cols" in args: i = args.index("--cols"); cols = int(args[i+1]); del args[i:i+2]
if "--w" in args:    i = args.index("--w");    w = int(args[i+1]);    del args[i:i+2]
video, out, frames = args[0], args[1], [int(f) for f in args[2:]]
cols = cols or len(frames)
h = round(w * 16 / 9)
with tempfile.TemporaryDirectory() as d:
    paths = []
    for n, f in enumerate(frames):
        p = os.path.join(d, f"{n:03d}.png")
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", video,
                        "-vf", f"select=eq(n\\,{f}),scale={w}:{h}", "-frames:v", "1", p], check=True)
        paths.append(p)
    rows = -(-len(paths) // cols)
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-pattern_type", "glob",
                    "-i", os.path.join(d, "*.png"),
                    "-filter_complex", f"tile={cols}x{rows}:margin=2:padding=2:color=0x444444",
                    "-frames:v", "1", out], check=True)
print(out)
