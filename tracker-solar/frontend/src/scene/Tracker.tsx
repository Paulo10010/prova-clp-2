import { Edges, Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PAINEL_SEGUE } from '../config.ts';
import { useStore } from '../store.ts';
import { rad } from '../util.ts';
import { Brush } from './Brush.tsx';
import { DIM } from './dimensoes.ts';
import { CameFimCurso, SensoresFimCurso } from './SensoresFimCurso.tsx';
import { criarTexturaPainel } from './textures.ts';
import { Contorno, Toon } from './toon.tsx';

const AMBAR = '#f2b43c';
const CIANO = '#4cc9f0';
const VERDE = '#7ee081';

export function Tracker() {
  const info = useStore((s) => s.info);
  const painel = useRef<THREE.Group>(null);
  const fantasma = useRef<THREE.Group>(null);
  const ponteiroReal = useRef<THREE.Group>(null);
  const ponteiroSp = useRef<THREE.Group>(null);
  const ponteiroSol = useRef<THREE.Group>(null);
  const moldura = useRef<THREE.MeshToonMaterial>(null);
  const textura = useMemo(() => criarTexturaPainel(), []);
  const tempo = useRef(0);

  const limL = info?.limiteLesteDeg ?? -60;
  const limO = info?.limiteOesteDeg ?? 60;

  useFrame((_, dt) => {
    tempo.current += dt;
    const s = useStore.getState().estado;
    if (!s || !painel.current) return;

    const realDeg = PAINEL_SEGUE === 'encoder' ? s.encoder.deg : s.eixo.posDeg;
    const alvo = rad(realDeg);
    const p = painel.current;
    p.rotation.z += (alvo - p.rotation.z) * Math.min(1, dt * 12); // suaviza entre amostras

    const sp = rad(s.eixo.setpointAtualDeg);
    if (fantasma.current) {
      fantasma.current.rotation.z = sp;
      fantasma.current.visible = Math.abs(s.eixo.setpointAtualDeg - realDeg) > 0.4;
    }
    if (ponteiroReal.current) ponteiroReal.current.rotation.z = p.rotation.z;
    if (ponteiroSp.current) ponteiroSp.current.rotation.z = sp;
    if (ponteiroSol.current) {
      ponteiroSol.current.rotation.z = rad(s.sol.anguloIdealLivreDeg);
      ponteiroSol.current.visible = s.sol.diurno;
    }
    if (moldura.current) {
      const alerta = s.flags.travado || s.flags.emergencia;
      const pulso = alerta ? 0.5 + 0.5 * Math.sin(tempo.current * 6) : 0;
      moldura.current.emissive.setRGB(pulso * 0.9, 0, 0);
    }
  });

  const H = DIM.alturaEixo;
  const L = DIM.comprimentoPainel;
  const W = DIM.larguraPainel;
  const yPainel = DIM.afastamentoPainel + DIM.espessuraPainel / 2;
  const zTransferidor = -DIM.comprimentoTubo / 2 - 0.05;
  const rT = 0.85;

  const arco = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let a = limL; a <= limO; a += 2) pts.push([-Math.sin(rad(a)) * rT, Math.cos(rad(a)) * rT, 0]);
    return pts;
  }, [limL, limO]);

  return (
    <group rotation-y={-rad(info?.eixoAzimuteDeg ?? 0)}>
      {/* Postes */}
      {[-L / 2 + 0.3, 0, L / 2 - 0.3].map((z) => (
        <mesh key={z} position={[0, H / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[0.12, H, 0.12]} />
          <Toon color="#8a939c" />
          <Contorno />
        </mesh>
      ))}

      {/* Tubo de torque */}
      <mesh position={[0, H, 0]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[DIM.raioTubo, DIM.raioTubo, DIM.comprimentoTubo, 20]} />
        <Toon color="#9aa3ab" />
        <Contorno />
      </mesh>

      {/* Motor de passo + redutor (poste central) */}
      <mesh position={[0, H - 0.22, 0]} castShadow>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <Toon color="#2b2f36" />
        <Contorno />
      </mesh>
      <Html position={[0.28, H - 0.22, 0]} center distanceFactor={9} className="rotulo3d">Motor de passo</Html>

      {/* Encoder na ponta norte do tubo */}
      <mesh position={[0, H, -DIM.comprimentoTubo / 2 + 0.05]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.09, 0.09, 0.1, 24]} />
        <Toon color={VERDE} />
        <Contorno />
      </mesh>

      {/* Painel (gira no eixo z) */}
      <group ref={painel} position={[0, H, 0]}>
        {[-L / 2 + 0.5, 0, L / 2 - 0.5].map((z) => (
          <mesh key={z} position={[0, DIM.afastamentoPainel / 2, z]} castShadow>
            <boxGeometry args={[W * 0.9, 0.05, 0.08]} />
            <Toon color="#7b848c" />
            <Contorno espessura={0.012} />
          </mesh>
        ))}
        <mesh position={[0, yPainel, 0]} castShadow receiveShadow>
          <boxGeometry args={[W, DIM.espessuraPainel, L]} />
          <Toon ref={moldura} color="#b9c0c7" />
          <Contorno espessura={0.022} />
        </mesh>
        <mesh position={[0, yPainel + DIM.espessuraPainel / 2 + 0.001, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[W - 0.02, L - 0.02]} />
          <Toon map={textura} />
        </mesh>
        {/* trilhos da escova */}
        {[-1, 1].map((lado) => (
          <mesh key={lado} position={[lado * (W / 2 + 0.05), yPainel + 0.02, 0]}>
            <boxGeometry args={[0.03, 0.03, L + 0.3]} />
            <Toon color="#59616a" />
            <Contorno espessura={0.01} />
          </mesh>
        ))}
        {/* normal do painel */}
        <Line points={[[0, yPainel + 0.05, 0], [0, 1.9, 0]]} color={CIANO} lineWidth={2} />
        <mesh position={[0, 1.95, 0]}>
          <coneGeometry args={[0.05, 0.14, 12]} />
          <meshBasicMaterial color={CIANO} />
        </mesh>
        <Brush />
        <CameFimCurso />
      </group>

      <SensoresFimCurso />

      {/* Fantasma do setpoint */}
      <group ref={fantasma} position={[0, H, 0]} visible={false}>
        <mesh position={[0, yPainel, 0]}>
          <boxGeometry args={[W, DIM.espessuraPainel, L]} />
          <meshBasicMaterial color={AMBAR} transparent opacity={0.1} depthWrite={false} />
          <Edges color={AMBAR} />
        </mesh>
      </group>

      {/* Transferidor na ponta norte: real (ciano), setpoint (âmbar), sol (tracejado) */}
      <group position={[0, H, zTransferidor]}>
        <Line points={arco} color="#5b6b7b" lineWidth={2} />
        {[limL, 0, limO].map((a) => (
          <Html key={a} position={[-Math.sin(rad(a)) * (rT + 0.18), Math.cos(rad(a)) * (rT + 0.18), 0]} center distanceFactor={9} className="rotulo3d">
            {a === 0 ? '0°' : a < 0 ? `L ${Math.abs(a)}°` : `O ${a}°`}
          </Html>
        ))}
        <group ref={ponteiroSol}>
          <Line points={[[0, 0, 0], [0, rT + 0.1, 0]]} color={AMBAR} lineWidth={1.5} dashed dashSize={0.06} gapSize={0.05} />
        </group>
        <group ref={ponteiroSp}>
          <mesh position={[0, rT / 2, 0.01]}>
            <boxGeometry args={[0.025, rT, 0.01]} />
            <meshBasicMaterial color={AMBAR} />
          </mesh>
        </group>
        <group ref={ponteiroReal}>
          <mesh position={[0, rT / 2, 0.02]}>
            <boxGeometry args={[0.04, rT, 0.012]} />
            <meshBasicMaterial color={CIANO} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
