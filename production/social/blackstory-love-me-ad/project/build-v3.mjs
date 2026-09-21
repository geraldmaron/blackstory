// Assemble the v003 edit from edit-v3.mjs: motion cards + product captures.
// Same method as build-edit.mjs -- trim to exact frames, stream-copy concat,
// composite the lockup, then the silent master and the sync-check copy. The
// Memorial pair keeps its 5-frame dissolve; everything else is a hard cut.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TIMELINE } from './edit-v3.mjs';

const FPS = '60000/1001',
  FR = 60000 / 1001;
const ROOT = path.resolve('..'),
  CAP = path.join(ROOT, 'captures');
const SEG = path.resolve('./segments-v3'),
  REN = path.join(ROOT, 'renders');
const V = process.argv[2] || 'v003';
fs.rmSync(SEG, { recursive: true, force: true });
fs.mkdirSync(SEG, { recursive: true });
const M = JSON.parse(fs.readFileSync(path.join(CAP, 'manifest.json')));
const run = (a) =>
  execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...a], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
const src = (n) => {
  if (!M[n]) throw new Error('missing capture ' + n);
  return [path.join(CAP, M[n].file), M[n].handle ?? 0];
};
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
const XF = 5;

const segs = [];
let k = 0;
for (let j = 0; j < TIMELINE.length; j++) {
  const s = TIMELINE[j],
    out = path.join(SEG, `${String(k++).padStart(2, '0')}-${s.name}.mp4`);
  const key = s.card ? s.name : s.capture;
  if (s.name === 'memorial-a') {
    const b = TIMELINE[j + 1];
    const [fa, ha] = src('memorial-a');
    const [fb, hb] = src('memorial-b');
    run([
      '-i',
      fa,
      '-i',
      fb,
      '-filter_complex',
      `[0:v]trim=start_frame=${ha}:end_frame=${ha + s.frames + XF},setpts=PTS-STARTPTS[a];` +
        `[1:v]trim=start_frame=${hb}:end_frame=${hb + b.frames},setpts=PTS-STARTPTS[b];` +
        `[a][b]xfade=transition=fade:duration=${(XF / FR).toFixed(6)}:offset=${(s.frames / FR).toFixed(6)},fps=${FPS}[v]`,
      '-map',
      '[v]',
      ...ENC,
      out,
    ]);
    segs.push([out, s.frames + b.frames]);
    j++;
    continue;
  }
  const [f, h] = src(key);
  if (s.overlay) {
    const [fg] = src(s.overlay);
    run([
      '-i',
      f,
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
  } else {
    run([
      '-i',
      f,
      '-filter_complex',
      `[0:v]trim=start_frame=${h}:end_frame=${h + s.frames},setpts=PTS-STARTPTS,fps=${FPS}[v]`,
      '-map',
      '[v]',
      ...ENC,
      out,
    ]);
  }
  segs.push([out, s.frames]);
}
const total = segs.reduce((a, s) => a + s[1], 0);
console.error(`${segs.length} segments, ${total} frames (expected 3264)`);
if (total !== 3264) throw new Error('frame count mismatch');

const list = path.join(SEG, 'concat.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s[0]}'`).join('\n'));
const master = path.join(REN, `blackstory-love-me-${V}.mp4`);
run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', master]);
run([
  '-i',
  master,
  '-i',
  path.join(ROOT, 'audio', 'reference-stereo48k.wav'),
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
  path.join(REN, `blackstory-love-me-${V}-synccheck.mp4`),
]);
console.error('master:', master);
