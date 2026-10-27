import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ESCALA_VISUAL_ROTACAO_ESCOVA, VEL_VISUAL_TRANSLACAO_ESCOVA } from '../config.ts';
import { useStore } from '../store.ts';
import { DIM } from './dimensoes.ts';
import { criarTexturaEscova } from './textures.ts';
import { Contorno, Toon } from './toon.tsx';

/**
 * Escova de limpeza: carro que percorre o painel ao longo do eixo.
 * Fica filha do grupo do painel, então inclina junto com ele.
 * A rotação vem da rpm estimada a partir da frequência do CFW10.
 */
export function Brush() {
  const carro = useRef<THREE.Group>(null);
  const rolo = useRef<THREE.Mesh>(null);
  const textura = useMemo(criarTexturaEscova, []);
  const dir = useRef(1);
  const giro = useRef(0);

  const y = DIM.afastamentoPainel + DIM.espessuraPainel + DIM.raioEscova + 0.01;
  const zMin = -DIM.comprimentoPainel / 2 + 0.2;
  const zMax = DIM.comprimentoPainel / 2 - 0.2;
  const zParado = -DIM.comprimentoPainel / 2 - 0.12;

  useFrame((_, dt) => {
    const s = useStore.getState().estado;
    const ligada = !!s?.flags.escovaLigada;
    const g = carro.current;
    const r = rolo.current;
    if (!g || !r) return;

    if (ligada) {
      if (g.position.z < zMin - 0.01) {
        g.position.z += VEL_VISUAL_TRANSLACAO_ESCOVA * dt; // entrando no painel
      } else {
        g.position.z += dir.current * VEL_VISUAL_TRANSLACAO_ESCOVA * dt;
        if (g.position.z > zMax) { g.position.z = zMax; dir.current = -1; }
        if (g.position.z < zMin) { g.position.z = zMin; dir.current = 1; }
      }
      const rps = ((s?.escova.rpmEscova ?? 0) / 60) * ESCALA_VISUAL_ROTACAO_ESCOVA;
      giro.current += rps * 2 * Math.PI * dt;
    } else {
      // volta para a posição de estacionamento
      g.position.z += (zParado - g.position.z) * Math.min(1, dt * 2);
      dir.current = 1;
    }
    r.rotation.set(giro.current, 0, Math.PI / 2);
  });

  const comp = DIM.larguraPainel + 0.1;
  return (
    <group ref={carro} position={[0, y, zParado]}>
      <mesh ref={rolo} castShadow>
        <cylinderGeometry args={[DIM.raioEscova, DIM.raioEscova, comp, 28, 1]} />
        <Toon map={textura} />
        <Contorno espessura={0.012} />
      </mesh>
      {[-1, 1].map((lado) => (
        <mesh key={lado} position={[lado * (comp / 2 + 0.05), 0, 0]} castShadow>
          <boxGeometry args={[0.1, 0.22, 0.26]} />
          <Toon color="#e7a83a" />
          <Contorno espessura={0.012} />
        </mesh>
      ))}
    </group>
  );
}
