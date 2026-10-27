import { Grid, Html, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { SunAndSky } from './SunAndSky.tsx';
import { criarTexturaGrama } from './textures.ts';
import { Toon } from './toon.tsx';
import { Tracker } from './Tracker.tsx';

const PONTOS_CARDEAIS: [string, [number, number, number]][] = [
  ['N', [0, 0.05, -7.5]],
  ['S', [0, 0.05, 7.5]],
  ['L', [7.5, 0.05, 0]],
  ['O', [-7.5, 0.05, 0]],
];

export function Scene3D() {
  const grama = useMemo(() => criarTexturaGrama(), []);

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [7.2, 4.4, 6.2], fov: 42, near: 0.1, far: 2000 }}>
      <SunAndSky />
      {/* névoa azulada ao longe, como a perspectiva atmosférica do BotW */}
      <fog attach="fog" args={['#a9d8f5', 28, 85]} />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[40, 64]} />
        <Toon map={grama} />
      </mesh>
      <Grid
        position={[0, 0.003, 0]}
        args={[30, 30]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#3b6a25"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#2e5418"
        fadeDistance={32}
        fadeStrength={1.5}
        infiniteGrid
      />
      {PONTOS_CARDEAIS.map(([t, p]) => (
        <Html key={t} position={p} center distanceFactor={12} className="cardeal">{t}</Html>
      ))}

      <Tracker />

      <OrbitControls
        target={[0, 1.4, 0]}
        enableDamping
        minDistance={3}
        maxDistance={25}
        maxPolarAngle={Math.PI / 2 - 0.04}
      />
    </Canvas>
  );
}
