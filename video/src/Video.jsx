import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import narration from '../narration.json';
import footage from './footage.json';
import voice from './voice-durations.json';

export const FPS = 30;
const VOICE_DELAY = 0.45; // seconds of quiet before the narration starts in each scene
const TAIL = 0.7; // seconds of quiet after it

const CARD_SCENES = new Set(['title', 'problem', 'architecture', 'outro']);
const STEP_LABEL = {
  dashboard: 'Dashboard',
  upload: 'Step 1 · AI review',
  reject: 'Step 2 · Policy check',
  pay: 'Step 3 · PayPal Payout',
  dues: 'Dues · PayPal Invoicing',
  assistant: 'Assistant',
  ledger: 'Ledger',
};

/** Work out how long each scene runs. Footage is slowed or sped up a little to fit its narration. */
const scenes = narration
  .filter((s) => CARD_SCENES.has(s.id) || footage[s.id])
  .map((s) => {
    const target = VOICE_DELAY + voice[s.id] + TAIL;
    if (CARD_SCENES.has(s.id)) return { ...s, frames: Math.round(target * FPS) };
    const clip = footage[s.id].duration;
    const rate = Math.min(1.5, Math.max(0.6, clip / target));
    return { ...s, rate, frames: Math.max(Math.round(target * FPS), Math.ceil((clip / rate) * FPS)) };
  });

let cursor = 0;
for (const s of scenes) {
  s.from = cursor;
  cursor += s.frames;
}
export const totalFrames = cursor;

const font = "'Segoe UI', system-ui, sans-serif";
const GRADIENT = 'linear-gradient(135deg, #1c1a55 0%, #2a1f7a 45%, #5b2bb5 100%)';

function FadeIn({ children, frames = 10 }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(frame, [0, frames], [0, 1], { extrapolateRight: 'clamp' }) }}>{children}</AbsoluteFill>;
}

function Rise({ delay = 0, children, style }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px)`, ...style }}>{children}</div>;
}

function Logo({ size = 120 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: 'linear-gradient(135deg, #5b5bf0 0%, #8b5cf6 55%, #c264f5 100%)',
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontWeight: 800,
        fontSize: size * 0.5,
        boxShadow: '0 20px 60px rgba(139, 92, 246, 0.55)',
      }}
    >
      C
    </div>
  );
}

function Title({ caption }) {
  return (
    <AbsoluteFill style={{ background: GRADIENT, fontFamily: font, color: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Rise>
        <Logo size={170} />
      </Rise>
      <Rise delay={8} style={{ fontSize: 150, fontWeight: 800, letterSpacing: -4, marginTop: 36 }}>
        ClubPay
      </Rise>
      <Rise delay={18} style={{ fontSize: 46, opacity: 0.9, color: '#d9d4ff' }}>
        {caption}
      </Rise>
    </AbsoluteFill>
  );
}

function Problem() {
  const points = [
    ['Members pay out of pocket', '#f59e0b', 30],
    ['Then wait weeks to be paid back', '#ec4899', 170],
    ['Records leave when the treasurer graduates', '#0ea5e9', 290],
  ];
  return (
    <AbsoluteFill style={{ background: '#f3f4fd', fontFamily: font, color: '#171a3a', padding: '120px 160px', justifyContent: 'center' }}>
      <Rise style={{ fontSize: 34, fontWeight: 700, color: '#5b5bf0', letterSpacing: 3 }}>THE PROBLEM</Rise>
      <Rise delay={6} style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2, lineHeight: 1.1, margin: '14px 0 60px', maxWidth: 1400 }}>
        Club money runs on a group chat and a spreadsheet.
      </Rise>
      {points.map(([text, color, delay]) => (
        <Rise key={text} delay={delay} style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 30 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: color }} />
          <div style={{ fontSize: 52, fontWeight: 600 }}>{text}</div>
        </Rise>
      ))}
    </AbsoluteFill>
  );
}

function Architecture({ caption }) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 300], [1, 1.04], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#f4f6fb', alignItems: 'center', justifyContent: 'center' }}>
      <Img src={staticFile('architecture.svg')} style={{ width: 1728, height: 1080, transform: `scale(${scale})` }} />
      <CaptionBar label="How it's built" caption={caption} />
    </AbsoluteFill>
  );
}

function Outro({ caption }) {
  const pill = { background: '#ffffff1f', border: '2px solid #ffffff44', borderRadius: 99, padding: '14px 34px', fontSize: 36, fontWeight: 600 };
  return (
    <AbsoluteFill style={{ background: GRADIENT, fontFamily: font, color: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Rise>
        <Logo size={130} />
      </Rise>
      <Rise delay={8} style={{ fontSize: 100, fontWeight: 800, letterSpacing: -3, marginTop: 30 }}>
        {caption}
      </Rise>
      <Rise delay={22} style={{ display: 'flex', gap: 24, marginTop: 50 }}>
        <div style={pill}>clubpay-8q3f.onrender.com</div>
        <div style={pill}>github.com/AYDEED7/ClubPay</div>
      </Rise>
      <Rise delay={36} style={{ fontSize: 30, marginTop: 44, color: '#cfc9ff' }}>
        PayPal Payouts, Invoicing and Webhooks · Google Gemini · React · AG Grid
      </Rise>
    </AbsoluteFill>
  );
}

function CaptionBar({ label, caption }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 46,
        display: 'flex',
        justifyContent: 'center',
        opacity: p,
        transform: `translateY(${(1 - p) * 30}px)`,
        fontFamily: font,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          background: 'rgba(23, 26, 58, 0.92)',
          color: '#fff',
          borderRadius: 22,
          padding: '18px 32px 18px 18px',
          boxShadow: '0 16px 40px rgba(10, 8, 50, 0.4)',
        }}
      >
        <div style={{ background: 'linear-gradient(135deg, #5b5bf0, #c264f5)', borderRadius: 14, padding: '10px 20px', fontSize: 28, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 36, fontWeight: 600 }}>{caption}</div>
      </div>
    </div>
  );
}

function Footage({ scene }) {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, scene.frames], [1, 1.025]);
  // Show the recorded frame that was on screen at this moment. Past the end, the last frame holds.
  const timeline = footage[scene.id].frames;
  const time = (frame / FPS) * scene.rate;
  let lo = 0;
  let hi = timeline.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (timeline[mid][0] <= time) lo = mid;
    else hi = mid - 1;
  }
  const file = staticFile(`footage/${scene.id}/${timeline[lo][1]}`);
  return (
    <AbsoluteFill style={{ background: GRADIENT }}>
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 40,
          width: 1728,
          height: 972,
          borderRadius: 26,
          overflow: 'hidden',
          boxShadow: '0 30px 90px rgba(5, 4, 40, 0.6)',
          transform: `scale(${zoom})`,
          background: '#f3f4fd',
        }}
      >
        <Img src={file} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
      <CaptionBar label={STEP_LABEL[scene.id]} caption={scene.caption} />
    </AbsoluteFill>
  );
}

function Scene({ scene }) {
  if (scene.id === 'title') return <Title caption={scene.caption} />;
  if (scene.id === 'problem') return <Problem />;
  if (scene.id === 'architecture') return <Architecture caption={scene.caption} />;
  if (scene.id === 'outro') return <Outro caption={scene.caption} />;
  return <Footage scene={scene} />;
}

export function ClubPayDemo() {
  return (
    <AbsoluteFill style={{ background: '#171a3a' }}>
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.frames}>
          <FadeIn>
            <Scene scene={scene} />
          </FadeIn>
          <Sequence from={Math.round(VOICE_DELAY * FPS)}>
            <Audio src={staticFile(`voice/${scene.id}.wav`)} />
          </Sequence>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
