// Renders one still from the middle-to-late part of every scene, for a quick visual check.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const narration = JSON.parse(fs.readFileSync('narration.json', 'utf8'));
const voice = JSON.parse(fs.readFileSync('src/voice-durations.json', 'utf8'));
const footage = JSON.parse(fs.readFileSync('src/footage.json', 'utf8'));
const cards = new Set(['title', 'problem', 'how', 'safety', 'architecture', 'next', 'outro']);
let from = 0;
const only = process.argv.slice(2);
for (const s of narration) {
  const target = 0.6 + voice[s.id] + 0.9;
  let frames = Math.round(target * 30);
  if (!cards.has(s.id)) {
    const clip = footage[s.id].duration;
    const rate = Math.min(1.5, Math.max(0.6, clip / target));
    frames = Math.max(frames, Math.ceil((clip / rate) * 30));
  }
  if (!only.length || only.includes(s.id)) {
    const at = from + Math.round(frames * 0.9);
    execSync(`npx remotion still src/index.jsx ClubPayDemo out/still-${s.id}.jpg --frame=${at} --image-format=jpeg --scale=0.5 --log=error`, { stdio: 'inherit' });
    console.log(s.id, 'frame', at);
  }
  from += frames;
}
console.log('total seconds', (from / 30).toFixed(1));
