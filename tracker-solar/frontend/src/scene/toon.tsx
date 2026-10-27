import { Outlines } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import { forwardRef } from 'react';
import * as THREE from 'three';

/**
 * Cel shading estilo "Breath of the Wild": luz em poucas faixas (sombra, meio-tom, luz)
 * e contorno escuro e fino nos objetos.
 */
function criarGradiente(): THREE.DataTexture {
  const faixas = [90, 170, 235, 255]; // sombra suave → meio-tom → luz → brilho
  const dados = new Uint8Array(faixas.length * 4);
  faixas.forEach((v, i) => dados.set([v, v, v, 255], i * 4));
  const t = new THREE.DataTexture(dados, faixas.length, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export const GRADIENTE_TOON = criarGradiente();

type ToonProps = Omit<ThreeElements['meshToonMaterial'], 'ref' | 'gradientMap'>;

/** meshToonMaterial com o gradiente compartilhado. */
export const Toon = forwardRef<THREE.MeshToonMaterial, ToonProps>((props, ref) => (
  <meshToonMaterial ref={ref} gradientMap={GRADIENTE_TOON} {...props} />
));

/** Contorno de desenho animado; colocar como filho de um <mesh>. */
export function Contorno({ espessura = 0.018, cor = '#1b2216' }: { espessura?: number; cor?: string }) {
  return <Outlines thickness={espessura} color={cor} />;
}
