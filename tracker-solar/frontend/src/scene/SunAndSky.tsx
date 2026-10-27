import { Line, Sky, Stars } from '@react-three/drei';
import { useStore } from '../store.ts';
import { vetorSol } from '../util.ts';
import { DIM } from './dimensoes.ts';

/** Céu, sol, iluminação e o raio solar até o painel. */
export function SunAndSky() {
  // arredonda para evitar re-render a cada amostra quando o relógio está lento
  const az = useStore((s) => Math.round((s.estado?.sol.azimuteDeg ?? 90) * 10) / 10);
  const el = useStore((s) => Math.round((s.estado?.sol.elevacaoDeg ?? 30) * 10) / 10);

  const [sx, sy, sz] = vetorSol(az, el);
  const dia = Math.max(0, Math.min(1, (el + 4) / 14)); // 0 noite … 1 dia claro
  const intensidadeSol = Math.max(0, Math.sin((el * Math.PI) / 180)) * 2.6;
  const origem: [number, number, number] = [0, DIM.alturaEixo + 0.3, 0];

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[sx * 100, sy * 100, sz * 100]}
        turbidity={2}
        rayleigh={el > 0 ? 2.2 : 0.5}
        mieCoefficient={0.003}
        mieDirectionalG={0.8}
      />
      {el < 3 && <Stars radius={120} depth={60} count={3000} factor={4} fade speed={0} />}

      <hemisphereLight color="#bcd4ff" groundColor="#3d6b24" intensity={0.15 + 0.45 * dia} />
      <ambientLight intensity={0.08 + 0.12 * dia} />
      <directionalLight
        position={[sx * 25, Math.max(0.5, sy * 25), sz * 25]}
        intensity={intensidadeSol}
        color={el < 12 ? '#ffc98a' : '#fff6e6'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
      />

      {el > -3 && (
        <>
          <mesh position={[sx * 60, sy * 60, sz * 60]}>
            <sphereGeometry args={[1.6, 24, 24]} />
            <meshBasicMaterial color="#ffd98a" toneMapped={false} />
          </mesh>
          <Line
            points={[origem, [origem[0] + sx * 4.5, origem[1] + sy * 4.5, origem[2] + sz * 4.5]]}
            color="#f2b43c"
            lineWidth={1.5}
            dashed
            dashSize={0.15}
            gapSize={0.1}
          />
        </>
      )}
    </>
  );
}
