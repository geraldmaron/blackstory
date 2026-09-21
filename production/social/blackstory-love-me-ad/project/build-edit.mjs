// Assemble the edit.
//
// Stage 1: trim each capture to its exact frame length, discarding handles.
// Stage 2: concatenate (stream copy -- no generational loss).
// Stage 3: brand overlay, then the two audio deliverables.
//
// Cuts are hard by default. The one soft transition in the piece is inside the
// Memorial, where a hard cut would be the wrong register; see DECISIONS.md §D6.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SHOTS } from './shots.mjs';

const R = 'ffmpeg';
const FPS = '60000/1001';
const ROOT = path.resolve('..');
const CAP = path.join(ROOT, 'captures');
const SEG = path.resolve('./segments');
const REN = path.join(ROOT, 'renders');
const VERSION = process.argv[2] || 'v001';
fs.mkdirSync(SEG, { recursive: true });
fs.mkdirSync(REN, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(path.join(CAP, 'manifest.json')));
const run = (args) =>
  execFileSync(R, ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const capFile = (n) => path.join(CAP, manifest[n].file);
const H = (n) => manifest[n].handle ?? 0;

const MEMORIAL_XFADE = 5; // frames
const ENC = [
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '12',
  '-x264-params',
  'keyint=2:min-keyint=2:scenecut=0',
  '-pix_fmt',
  'yuv420p',
  '-r',
  FPS,
];

const timeline = SHOTS.filter((s) => s.name !== 'brand-fg');
const segs = [];
let idx = 0;

for (const s of timeline) {
  const name = s.name;
  if (!manifest[name]) throw new Error(`missing capture: ${name}`);
  const out = path.join(SEG, `${String(idx).padStart(2, '0')}-${name}.mp4`);
  const h = H(name);

  if (name === 'memorial-a') {
    // A runs MEMORIAL_XFADE frames long so it can cross into B without the
    // combined length changing.
    const a = capFile('memorial-a'),
      b = capFile('memorial-b');
    const ha = H('memorial-a'),
      hb = H('memorial-b');
    const na = s.frames + MEMORIAL_XFADE,
      nb = SHOTS.find((x) => x.name === 'memorial-b').frames;
    const off = (s.frames / (60000 / 1001)).toFixed(6);
    const dur = (MEMORIAL_XFADE / (60000 / 1001)).toFixed(6);
    run([
      '-i',
      a,
      '-i',
      b,
      '-filter_complex',
      `[0:v]trim=start_frame=${ha}:end_frame=${ha + na},setpts=PTS-STARTPTS[a];` +
        `[1:v]trim=start_frame=${hb}:end_frame=${hb + nb},setpts=PTS-STARTPTS[b];` +
        `[a][b]xfade=transition=fade:duration=${dur}:offset=${off},fps=${FPS}[v]`,
      '-map',
      '[v]',
      ...ENC,
      out,
    ]);
    segs.push({ file: out, name: 'memorial-a+b', frames: s.frames + nb });
    idx++;
    continue;
  }
  if (name === 'memorial-b') continue; // folded into the pair above

  if (name === 'brand-bg') {
    // The lockup is a separate alpha capture composited over the settling map.
    const fg = capFile('brand-fg');
    run([
      '-i',
      capFile(name),
      '-i',
      fg,
      '-filter_complex',
      `[0:v]trim=start_frame=${h}:end_frame=${h + s.frames},setpts=PTS-STARTPTS[bg];` +
        `[1:v]trim=start_frame=0:end_frame=${s.frames},setpts=PTS-STARTPTS,format=rgba[fg];` +
        `[bg][fg]overlay=0:0:format=auto,fps=${FPS}[v]`,
      '-map',
      '[v]',
      ...ENC,
      out,
    ]);
    segs.push({ file: out, name: 'brand', frames: s.frames });
    idx++;
    continue;
  }

  run([
    '-i',
    capFile(name),
    '-filter_complex',
    `[0:v]trim=start_frame=${h}:end_frame=${h + s.frames},setpts=PTS-STARTPTS,fps=${FPS}[v]`,
    '-map',
    '[v]',
    ...ENC,
    out,
  ]);
  segs.push({ file: out, name, frames: s.frames });
  idx++;
}

const total = segs.reduce((a, s) => a + s.frames, 0);
console.error(`${segs.length} segments, ${total} frames (expected 3264)`);

const listFile = path.join(SEG, 'concat.txt');
fs.writeFileSync(listFile, segs.map((s) => `file '${s.file}'`).join('\n'));
const silentMaster = path.join(REN, `blackstory-love-me-${VERSION}-silent.mp4`);
run(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silentMaster]);

// Deliverable A: upload master. Silent AAC track so the container is well-formed
// and TikTok accepts it; the AMBNT sound is attached in-app (DECISIONS.md D3).
const master = path.join(REN, `blackstory-love-me-${VERSION}.mp4`);
run([
  '-i',
  silentMaster,
  '-f',
  'lavfi',
  '-i',
  'anullsrc=r=48000:cl=stereo',
  '-shortest',
  '-c:v',
  'copy',
  '-c:a',
  'aac',
  '-b:a',
  '128k',
  '-movflags',
  '+faststart',
  master,
]);

// Deliverable B: local review copy carrying the reference audio, for sync QA only.
const sync = path.join(REN, `blackstory-love-me-${VERSION}-synccheck.mp4`);
run([
  '-i',
  silentMaster,
  '-i',
  path.join(ROOT, 'audio', 'reference-stereo48k.wav'),
  // The audio runs 2.4ms short of 3264 frames; pad it so -shortest trims to
  // the video and every frame survives (v001 lost its last frame here).
  '-map',
  '0:v',
  '-map',
  '1:a',
  '-af',
  'apad',
  '-c:v',
  'copy',
  '-c:a',
  'aac',
  '-b:a',
  '256k',
  '-shortest',
  '-movflags',
  '+faststart',
  sync,
]);

fs.unlinkSync(silentMaster);
console.error(`\nmaster:    ${master}\nsynccheck: ${sync}`);
