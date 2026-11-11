// Generates one narration MP3 per scene with a Microsoft Edge neural voice, and records each clip's length.
//
//   node scripts/make-voice.mjs [voiceName]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'voice');
fs.mkdirSync(outDir, { recursive: true });
const scenes = JSON.parse(fs.readFileSync(path.join(root, 'narration.json'), 'utf8'));
const voice = process.argv[2] || 'en-US-AndrewNeural';

const tts = new MsEdgeTTS();
await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

const durations = {};
for (const scene of scenes) {
  const file = path.join(outDir, `${scene.id}.mp3`);
  const { audioStream } = await tts.toStream(scene.text);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(file);
    audioStream.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    audioStream.pipe(out);
  });
  const probe = execFileSync(
    'npx remotion ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "' + file + '"',
    { cwd: root, shell: true, encoding: 'utf8' },
  );
  durations[scene.id] = Number(Number(probe.trim().split(/\s+/).pop()).toFixed(2));
  console.log(scene.id.padEnd(14), durations[scene.id] + 's');
}
tts.close();
fs.writeFileSync(path.join(root, 'src', 'voice-durations.json'), JSON.stringify(durations, null, 2));
console.log('Voice:', voice, '| total', Object.values(durations).reduce((a, b) => a + b, 0).toFixed(1) + 's');
