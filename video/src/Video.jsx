import {
  AbsoluteFill,
  Audio,
  Easing,
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
const VOICE_DELAY = 0.6; // seconds of quiet before the narration starts in each scene
const TAIL = 0.9; // seconds of quiet after it

const CARD_SCENES = new Set(['title', 'problem', 'how', 'safety', 'architecture', 'next', 'outro']);
const STEP_LABEL = {
  dashboard: 'Dashboard',
  upload: 'Step 1 · AI review',
  reject: 'Step 2 · Policy check',
  pay: 'Step 3 · PayPal Payout',
  dues: 'Dues · PayPal Invoicing',
  assistant: 'Assistant',
  ledger: 'Ledger · AG Grid',
};
/** Where the camera pushes in during each app scene: [x, y] as fractions of the screen, zoom level, and when it starts. */
const FOCUS = {
  dashboard: { x: 0.6, y: 0.3, zoom: 1.08, start: 0.15 },
  upload: { x: 0.57, y: 0.45, zoom: 1.28, start: 0.6 },
  reject: { x: 0.57, y: 0.45, zoom: 1.28, start: 0.52 },
  pay: { x: 0.45, y: 1, zoom: 1.3, start: 0.55, lift: 0.3 },
  dues: { x: 0.6, y: 1, zoom: 1.22, start: 0.6, lift: 0.14 },
  assistant: { x: 0.62, y: 0.22, zoom: 1.18, start: 0.6 },
  ledger: { x: 0.62, y: 0.42, zoom: 1.12, start: 0.3 },
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
const INK = '#171a3a';
const BRAND = 'linear-gradient(135deg, #5b5bf0 0%, #8b5cf6 55%, #c264f5 100%)';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

// ---------- shared motion pieces ----------

/** Slow drifting colour blobs behind everything. */
function Backdrop({ dark = true }) {
  const frame = useCurrentFrame();
  const blobs = dark
    ? [['#5b5bf0', 0.2, 0.25, 760], ['#c264f5', 0.82, 0.3, 640], ['#0ea5e9', 0.6, 0.85, 700], ['#8b5cf6', 0.12, 0.8, 560]]
    : [['#c7c2ff', 0.15, 0.2, 760], ['#bfe9ff', 0.85, 0.75, 700], ['#f3c8ff', 0.8, 0.15, 560]];
  return (
    <AbsoluteFill style={{ background: dark ? '#17153f' : '#f3f4fd', overflow: 'hidden' }}>
      {blobs.map(([color, x, y, size], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: '50%',
            background: color,
            opacity: dark ? 0.55 : 0.75,
            filter: 'blur(120px)',
            left: `calc(${x * 100}% - ${size / 2}px)`,
            top: `calc(${y * 100}% - ${size / 2}px)`,
            transform: `translate(${Math.sin(frame / 55 + i * 1.7) * 90}px, ${Math.cos(frame / 70 + i) * 70}px)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
}

/** Spring-in for one element: fades, rises and settles. */
function Pop({ delay = 0, children, style, from = 'up', distance = 50 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 14, mass: 0.7 } });
  const o = interpolate(frame - delay, [0, 8], [0, 1], clamp);
  const offset = (1 - p) * distance;
  const move = from === 'left' ? `translateX(${-offset}px)` : from === 'right' ? `translateX(${offset}px)` : `translateY(${offset}px)`;
  return <div style={{ opacity: o, transform: `${move} scale(${0.92 + 0.08 * p})`, ...style }}>{children}</div>;
}

/** Scene entrance: slides up into place while a gradient curtain sweeps away. */
function Enter({ children }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  const sweep = interpolate(frame, [0, 16], [0, 110], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateY(${(1 - p) * 70}px) scale(${0.96 + 0.04 * p})`, opacity: interpolate(frame, [0, 6], [0, 1], clamp) }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: BRAND, transform: `translateX(${sweep}%) skewX(-8deg) scaleX(1.2)`, opacity: frame < 17 ? 1 : 0 }} />
    </AbsoluteFill>
  );
}

function Logo({ size = 120 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: BRAND,
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontWeight: 800,
        fontSize: size * 0.5,
        fontFamily: font,
        boxShadow: '0 20px 60px rgba(139, 92, 246, 0.6)',
      }}
    >
      C
    </div>
  );
}

function Icon({ d, size = 64, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  receipt: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h3',
  spark: 'M12 3l1.800 4.700L18.500 9.500l-4.700 1.800L12 16l-1.800-4.700L5.500 9.500l4.700-1.800zM19 15l.800 2.200L22 18l-2.200.800L19 21l-.800-2.200L16 18l2.200-.800z',
  money: 'M3 7h18v10H3zM12 9.500a2.500 2.500 0 1 0 0 5a2.500 2.500 0 0 0 0-5zM6 10v4M18 10v4',
  shield: 'M12 3l8 3v6c0 4.500-3.200 8-8 9c-4.800-1-8-4.500-8-9V6zM8.500 12l2.500 2.500l4.500-5',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1M12 14.500l2 2l3.500-4',
  lock: 'M6 11h12v9H6zM8.500 11V7.500a3.500 3.500 0 0 1 7 0V11M12 14.500v2',
  users: 'M9 11a3.500 3.500 0 1 0 0-7a3.500 3.500 0 0 0 0 7zM2.500 20c.500-3.500 3-5.500 6.500-5.500s6 2 6.500 5.500M16 4.500a3.500 3.500 0 0 1 0 6.500M18 14.800c2 .700 3.200 2.500 3.500 5.200',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  flag: 'M5 21V4M5 4h11l-2 4l2 4H5',
};

/** Caption that lights up word by word in time with the narration. */
function Caption({ label, text, seconds }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const words = text.split(' ');
  const start = VOICE_DELAY * fps;
  const span = Math.min(seconds * 0.55, words.length * 0.32) * fps;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 54, display: 'flex', justifyContent: 'center', opacity: p, transform: `translateY(${(1 - p) * 40}px)`, fontFamily: font }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, background: 'rgba(23, 26, 58, 0.94)', borderRadius: 24, padding: '18px 34px 18px 18px', boxShadow: '0 18px 50px rgba(10, 8, 50, 0.5)', border: '1px solid #ffffff22' }}>
        <div style={{ background: BRAND, borderRadius: 15, padding: '10px 20px', fontSize: 28, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: 36, fontWeight: 600, display: 'flex', gap: 11 }}>
          {words.map((w, i) => {
            const at = start + (i / words.length) * span;
            const lit = interpolate(frame, [at, at + 5], [0, 1], clamp);
            return (
              <span key={i} style={{ color: lit > 0.5 ? '#fff' : '#8f93c4', transform: `translateY(${(1 - lit) * 5}px)`, display: 'inline-block' }}>
                {w}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- card scenes ----------

function Title({ scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 9, mass: 0.8 } });
  const chips = [
    ['receipt', 0.14, 0.24, '#f59e0b'],
    ['money', 0.84, 0.22, '#10b981'],
    ['spark', 0.2, 0.76, '#ec4899'],
    ['shield', 0.82, 0.74, '#0ea5e9'],
  ];
  return (
    <AbsoluteFill style={{ fontFamily: font, color: '#fff' }}>
      <Backdrop />
      {chips.map(([icon, x, y, color], i) => {
        const p = spring({ frame: frame - 14 - i * 6, fps, config: { damping: 11 } });
        return (
          <div
            key={icon}
            style={{
              position: 'absolute',
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: 130,
              height: 130,
              borderRadius: 34,
              background: color,
              display: 'grid',
              placeItems: 'center',
              boxShadow: `0 20px 50px ${color}88`,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${Math.sin(frame / 28 + i) * 9}deg) translateY(${Math.sin(frame / 22 + i * 2) * 16}px)`,
            }}
          >
            <Icon d={ICONS[icon]} size={70} />
          </div>
        );
      })}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${pop}) rotate(${(1 - pop) * -25}deg)` }}>
          <Logo size={180} />
        </div>
        <div style={{ display: 'flex', fontSize: 170, fontWeight: 800, letterSpacing: -5, marginTop: 30 }}>
          {'ClubPay'.split('').map((ch, i) => {
            const p = spring({ frame: frame - 10 - i * 3, fps, config: { damping: 12 } });
            return (
              <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 90}px) rotate(${(1 - p) * 12}deg)` }}>
                {ch}
              </span>
            );
          })}
        </div>
        <Pop delay={36} style={{ fontSize: 46, color: '#dcd7ff' }}>
          {scene.caption}
        </Pop>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Problem({ scene }) {
  const f = scene.frames;
  const bubbles = [
    ['who paid for the pizza last week??', 'left', '#ffffff', INK, 0.1],
    ['me. still waiting on my $51', 'right', '#5b5bf0', '#fff', 0.24],
    ['it has been THREE weeks', 'right', '#5b5bf0', '#fff', 0.36],
    ['is it in the spreadsheet?', 'left', '#ffffff', INK, 0.5],
    ['which spreadsheet', 'right', '#5b5bf0', '#fff', 0.62],
    ['ask last year\'s treasurer… they graduated', 'left', '#ffffff', INK, 0.76],
  ];
  return (
    <AbsoluteFill style={{ fontFamily: font, color: INK }}>
      <Backdrop dark={false} />
      <div style={{ position: 'absolute', left: 130, top: 0, bottom: 0, width: 780, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Pop style={{ fontSize: 32, fontWeight: 800, color: '#5b5bf0', letterSpacing: 4 }}>THE PROBLEM</Pop>
        <Pop delay={8} style={{ fontSize: 88, fontWeight: 800, letterSpacing: -2.5, lineHeight: 1.08, marginTop: 18 }}>
          Club money runs on a group chat and a spreadsheet.
        </Pop>
        <Pop delay={Math.round(f * 0.55)} style={{ fontSize: 40, fontWeight: 600, color: '#d92d4b', marginTop: 36 }}>
          Weeks to get paid back. Records lost every year.
        </Pop>
      </div>
      <div style={{ position: 'absolute', right: 110, top: 150, width: 760, height: 780, background: '#ffffffd9', borderRadius: 44, boxShadow: '0 30px 80px rgba(52, 46, 140, 0.22)', padding: '34px 38px', display: 'flex', flexDirection: 'column', gap: 20, border: '1px solid #e6e8f5' }}>
        <div style={{ fontSize: 30, fontWeight: 800, paddingBottom: 14, borderBottom: '2px solid #eceefa', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: '#10b981' }} />
          Robotics Club · group chat
        </div>
        {bubbles.map(([text, side, bg, color, at]) => (
          <Pop key={text} delay={Math.round(f * at)} from={side} distance={70} style={{ alignSelf: side === 'left' ? 'flex-start' : 'flex-end', background: bg, color, fontSize: 34, fontWeight: 600, padding: '16px 26px', borderRadius: 28, maxWidth: 600, boxShadow: '0 8px 22px rgba(23, 26, 58, 0.12)', border: side === 'left' ? '1px solid #e6e8f5' : 'none' }}>
            {text}
          </Pop>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function How({ scene }) {
  const frame = useCurrentFrame();
  const f = scene.frames;
  const steps = [
    ['receipt', 'Snap', 'A member photographs the receipt', '#f59e0b', 0.24],
    ['spark', 'Check', 'AI checks it against club rules', '#8b5cf6', 0.48],
    ['money', 'Pay', 'PayPal pays, with one click', '#10b981', 0.7],
  ];
  return (
    <AbsoluteFill style={{ fontFamily: font, color: '#fff' }}>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Pop style={{ fontSize: 32, fontWeight: 800, letterSpacing: 4, color: '#cfc9ff' }}>HOW CLUBPAY WORKS</Pop>
        <Pop delay={6} style={{ fontSize: 86, fontWeight: 800, letterSpacing: -2.5, marginBottom: 70 }}>
          Three steps. One click.
        </Pop>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {steps.map(([icon, title, text, color, at], i) => {
            const start = Math.round(f * at);
            const line = interpolate(frame, [start - 14, start], [0, 1], clamp);
            return (
              <div key={title} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && (
                  <div style={{ width: 150, height: 8, background: '#ffffff2e', borderRadius: 4, margin: '0 20px', overflow: 'hidden' }}>
                    <div style={{ width: `${line * 100}%`, height: '100%', background: '#fff', borderRadius: 4 }} />
                  </div>
                )}
                <Pop delay={start} style={{ width: 400, background: '#ffffff14', border: '2px solid #ffffff33', borderRadius: 40, padding: '44px 34px', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
                  <div style={{ width: 130, height: 130, borderRadius: 36, background: color, display: 'grid', placeItems: 'center', margin: '0 auto 26px', boxShadow: `0 18px 44px ${color}99` }}>
                    <Icon d={ICONS[icon]} size={72} />
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#cfc9ff', letterSpacing: 3 }}>STEP {i + 1}</div>
                  <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -1.5 }}>{title}</div>
                  <div style={{ fontSize: 31, color: '#dedbff', marginTop: 8, lineHeight: 1.3 }}>{text}</div>
                </Pop>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Safety({ scene }) {
  const f = scene.frames;
  const items = [
    ['shield', 'The AI only recommends', 'A human treasurer releases every payout', '#5b5bf0', 0.3],
    ['copy', 'Duplicates caught in code', 'A fixed check, not left to the model', '#f59e0b', 0.52],
    ['lock', 'Webhooks are verified', 'Nothing changes without PayPal\'s signature', '#10b981', 0.74],
  ];
  return (
    <AbsoluteFill style={{ fontFamily: font, color: INK }}>
      <Backdrop dark={false} />
      <AbsoluteFill style={{ padding: '0 150px', justifyContent: 'center' }}>
        <Pop style={{ fontSize: 32, fontWeight: 800, color: '#5b5bf0', letterSpacing: 4 }}>SAFE BY DESIGN</Pop>
        <Pop delay={6} style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2.5, lineHeight: 1.08, margin: '14px 0 54px' }}>
          The AI can't spend money on its own.
        </Pop>
        <div style={{ display: 'flex', gap: 34 }}>
          {items.map(([icon, title, text, color, at]) => (
            <Pop key={title} delay={Math.round(f * at)} style={{ flex: 1, background: '#fff', borderRadius: 36, padding: '40px 38px', boxShadow: '0 24px 60px rgba(52, 46, 140, 0.16)', borderTop: `8px solid ${color}` }}>
              <div style={{ width: 96, height: 96, borderRadius: 28, background: color, display: 'grid', placeItems: 'center', marginBottom: 24 }}>
                <Icon d={ICONS[icon]} size={54} />
              </div>
              <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1, lineHeight: 1.15 }}>{title}</div>
              <div style={{ fontSize: 30, color: '#6b7194', marginTop: 12, lineHeight: 1.35 }}>{text}</div>
            </Pop>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Architecture({ scene }) {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [10, 70], [0, 100], { ...clamp, easing: Easing.out(Easing.cubic) });
  const scale = interpolate(frame, [0, scene.frames], [1.0, 1.06]);
  return (
    <AbsoluteFill style={{ background: '#f4f6fb', alignItems: 'center', justifyContent: 'center' }}>
      <Img src={staticFile('architecture.svg')} style={{ width: 1728, height: 1080, transform: `scale(${scale}) translateY(-30px)`, clipPath: `inset(0 ${100 - reveal}% 0 0)` }} />
      <Caption label="How it's built" text={scene.caption} seconds={voice[scene.id]} />
    </AbsoluteFill>
  );
}

function Next({ scene }) {
  const f = scene.frames;
  const items = [
    ['lock', 'Logins and roles', 'Treasurers approve, members submit', 0.22],
    ['grid', 'More than one club', 'Each with its own budget and rules', 0.45],
    ['flag', 'Pilot with real clubs', 'Starting on our own campus', 0.68],
  ];
  return (
    <AbsoluteFill style={{ fontFamily: font, color: '#fff' }}>
      <Backdrop />
      <AbsoluteFill style={{ padding: '0 170px', justifyContent: 'center' }}>
        <Pop style={{ fontSize: 32, fontWeight: 800, letterSpacing: 4, color: '#cfc9ff' }}>WHAT'S NEXT</Pop>
        <Pop delay={6} style={{ fontSize: 86, fontWeight: 800, letterSpacing: -2.5, marginBottom: 50 }}>
          From demo to real clubs.
        </Pop>
        {items.map(([icon, title, text, at], i) => (
          <Pop key={title} delay={Math.round(f * at)} from="left" distance={120} style={{ display: 'flex', alignItems: 'center', gap: 30, background: '#ffffff14', border: '2px solid #ffffff2e', borderRadius: 30, padding: '26px 34px', marginBottom: 24, width: 1180 }}>
            <div style={{ width: 84, height: 84, borderRadius: 24, background: BRAND, display: 'grid', placeItems: 'center', flex: 'none' }}>
              <Icon d={ICONS[icon]} size={46} />
            </div>
            <div>
              <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1 }}>{title}</div>
              <div style={{ fontSize: 30, color: '#d5d1ff' }}>{text}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 70, fontWeight: 800, color: '#ffffff33' }}>0{i + 1}</div>
          </Pop>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Outro({ scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pill = { background: '#ffffff1f', border: '2px solid #ffffff55', borderRadius: 99, padding: '16px 38px', fontSize: 38, fontWeight: 700 };
  const dots = Array.from({ length: 26 }, (_, i) => i);
  const colors = ['#f59e0b', '#10b981', '#ec4899', '#0ea5e9', '#ffffff'];
  return (
    <AbsoluteFill style={{ fontFamily: font, color: '#fff' }}>
      <Backdrop />
      {dots.map((i) => {
        const x = (i * 137.5) % 100;
        const speed = 2.2 + (i % 5) * 0.7;
        const y = ((frame * speed + i * 83) % 1300) - 110;
        return <div key={i} style={{ position: 'absolute', left: `${x}%`, top: 1080 - y, width: 16 + (i % 3) * 8, height: 16 + (i % 3) * 8, borderRadius: i % 2 ? '50%' : 5, background: colors[i % 5], opacity: 0.55, transform: `rotate(${frame * 3 + i * 40}deg)` }} />;
      })}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${spring({ frame, fps, config: { damping: 9 } })})` }}>
          <Logo size={140} />
        </div>
        <div style={{ display: 'flex', gap: 26, fontSize: 108, fontWeight: 800, letterSpacing: -3, marginTop: 34 }}>
          {scene.caption.split(' ').map((w, i) => (
            <Pop key={i} delay={10 + i * 5} distance={80}>
              {w}
            </Pop>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 26, marginTop: 54 }}>
          <Pop delay={48} from="left" style={pill}>
            clubpay-8q3f.onrender.com
          </Pop>
          <Pop delay={56} from="right" style={pill}>
            github.com/AYDEED7/ClubPay
          </Pop>
        </div>
        <Pop delay={70} style={{ fontSize: 31, marginTop: 46, color: '#d5d1ff' }}>
          PayPal Payouts, Invoicing and Webhooks · Google Gemini · React · AG Grid
        </Pop>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------- real app footage ----------

function Footage({ scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
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

  // The window tilts in, then the camera pushes in on the part that matters.
  const settle = spring({ frame: frame - 4, fps, config: { damping: 18, mass: 0.9 } });
  const focus = FOCUS[scene.id];
  const zoomStart = scene.frames * focus.start;
  const push = interpolate(frame, [zoomStart, zoomStart + 34], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const zoom = 1 + (focus.zoom - 1) * push;

  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: 'absolute',
            left: 112,
            top: 34,
            width: 1696,
            height: 954,
            borderRadius: 28,
            overflow: 'hidden',
            boxShadow: '0 40px 110px rgba(5, 4, 40, 0.7)',
            border: '2px solid #ffffff2a',
            background: '#f3f4fd',
            transform: `rotateX(${(1 - settle) * 14}deg) rotateY(${(1 - settle) * -8}deg) scale(${0.86 + 0.14 * settle})`,
          }}
        >
          <Img src={file} style={{ width: '100%', height: '100%', display: 'block', transform: `translateY(${-(focus.lift || 0) * push * 954}px) scale(${zoom})`, transformOrigin: `${focus.x * 100}% ${focus.y * 100}%` }} />
        </div>
      </AbsoluteFill>
      <Caption label={STEP_LABEL[scene.id]} text={scene.caption} seconds={voice[scene.id]} />
    </AbsoluteFill>
  );
}

function Scene({ scene }) {
  const cards = { title: Title, problem: Problem, how: How, safety: Safety, architecture: Architecture, next: Next, outro: Outro };
  const Card = cards[scene.id];
  return Card ? <Card scene={scene} /> : <Footage scene={scene} />;
}

/** Thin progress bar across the bottom, with a tick for each scene. */
function Progress() {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: '#00000055' }}>
      <div style={{ width: `${(frame / totalFrames) * 100}%`, height: '100%', background: BRAND }} />
      {scenes.slice(1).map((s) => (
        <div key={s.id} style={{ position: 'absolute', left: `${(s.from / totalFrames) * 100}%`, top: 0, width: 3, height: '100%', background: '#ffffff88' }} />
      ))}
    </div>
  );
}

export function ClubPayDemo() {
  return (
    <AbsoluteFill style={{ background: '#17153f' }}>
      {scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.frames}>
          <Enter>
            <Scene scene={scene} />
          </Enter>
          <Sequence from={Math.round(VOICE_DELAY * FPS)}>
            <Audio src={staticFile(`voice/${scene.id}.mp3`)} />
          </Sequence>
        </Sequence>
      ))}
      <Progress />
    </AbsoluteFill>
  );
}
