// Turns the recorded frames into one timed image sequence per scene, trimming the marked waits.
// Remotion plays these sequences directly, so there is no intermediate video file.
//
//   node scripts/build-clips.mjs [framesDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const framesDir = path.resolve(root, process.argv[2] || '.frames');
const outDir = path.join(root, 'public', 'footage');

const { frames, segments } = JSON.parse(fs.readFileSync(path.join(framesDir, 'frames.json'), 'utf8'));
const footageFile = path.join(root, 'src', 'footage.json');
const footage = fs.existsSync(footageFile) ? JSON.parse(fs.readFileSync(footageFile, 'utf8')) : {};

for (const seg of segments) {
  if (!seg.end) continue;
  const inCut = (t) => seg.cuts.some(([a, b]) => t > a && t < b);
  // Start from whatever was on screen when the scene began.
  const before = frames.filter((f) => f.t < seg.start).at(-1);
  const kept = [
    ...(before ? [{ file: before.file, t: seg.start }] : []),
    ...frames.filter((f) => f.t >= seg.start && f.t <= seg.end && !inCut(f.t)),
  ];
  if (kept.length < 2) continue;

  const dir = path.join(outDir, seg.name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const timeline = [];
  let at = 0;
  kept.forEach((f, i) => {
    const name = `${String(i).padStart(4, '0')}.jpg`;
    fs.copyFileSync(path.join(framesDir, f.file), path.join(dir, name));
    timeline.push([Number(at.toFixed(3)), name]);
    const next = kept[i + 1];
    if (!next) at += 0.6;
    else if (seg.cuts.some(([a, b]) => f.t <= a && next.t >= b)) at += 0.4; // jump over a trimmed wait
    else at += Math.min((next.t - f.t) / 1000, 4);
  });
  footage[seg.name] = { duration: Number(at.toFixed(2)), frames: timeline };
  console.log(`${seg.name}: ${kept.length} frames -> ${at.toFixed(1)}s`);
}
fs.writeFileSync(footageFile, JSON.stringify(footage));
