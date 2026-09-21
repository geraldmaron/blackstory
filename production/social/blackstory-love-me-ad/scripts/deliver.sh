#!/usr/bin/env bash
# Delivery encode. The build output (renders/<v>.mp4) is a near-all-intra
# mezzanine at ~60 Mb/s -- right for editing, wrong for upload. This makes the
# platform file: H.264 High, 1s GOP, CRF 16 capped at 30 Mb/s, BT.709 tagged.
set -euo pipefail
SRC="$1"; OUT="$2"; AUDIO="${3:-}"
V=(-c:v libx264 -preset slow -crf 16 -maxrate 30M -bufsize 60M -profile:v high -level 5.1
   -g 60 -keyint_min 60 -pix_fmt yuv420p
   -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart)
if [ -n "$AUDIO" ]; then
  ffmpeg -nostdin -v error -y -i "$SRC" -i "$AUDIO" -map 0:v -map 1:a -af apad -shortest \
    "${V[@]}" -c:a aac -b:a 256k "$OUT"
else
  ffmpeg -nostdin -v error -y -i "$SRC" -f lavfi -i anullsrc=r=48000:cl=stereo -map 0:v -map 1:a -shortest \
    "${V[@]}" -c:a aac -b:a 128k "$OUT"
fi
