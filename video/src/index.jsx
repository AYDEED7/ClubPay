import { Composition, registerRoot } from 'remotion';
import { ClubPayDemo, FPS, totalFrames } from './Video.jsx';

function Root() {
  return (
    <Composition id="ClubPayDemo" component={ClubPayDemo} durationInFrames={totalFrames} fps={FPS} width={1920} height={1080} />
  );
}

registerRoot(Root);
