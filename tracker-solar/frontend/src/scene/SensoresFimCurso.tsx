import { Html, Line } from '@react-three/drei';
import { useStore } from '../store.ts';
import { rad } from '../util.ts';
import { DIM } from './dimensoes.ts';
import { Contorno, Toon } from './toon.tsx';

/**
 * Sensores indutivos de fim de curso (leste e oeste) e o sensor óptico da
 * posição de limpeza, na ponta sul do tubo.
 * Um came metálico preso ao tubo gira com o painel; quando o painel chega ao
 * limite, o came fica de frente para o sensor e o LED do sensor acende.
 *
 * Geometria: num grupo girado de `a` em z, o ponto local (0, −r) fica na direção
 * do came quando o painel está em `a`. Por isso cada sensor fica a −r no grupo
 * girado do seu ângulo-limite.
 */
export const Z_SENSORES = DIM.comprimentoTubo / 2 - 0.25;

const R_CAME = 0.24;     // ponta do came
const R_SENSOR = 0.31;   // centro do corpo do sensor (face a ~2 cm do came)
const R_BRACO = 0.5;     // onde o braço encontra o poste de suporte

/** Came que gira junto com o painel — colocar dentro do grupo do painel. */
export function CameFimCurso() {
  const comp = R_CAME - DIM.raioTubo;
  return (
    <mesh position={[0, -(DIM.raioTubo + comp / 2), Z_SENSORES]} castShadow>
      <boxGeometry args={[0.05, comp, 0.04]} />
      <Toon color="#c0c6cc" />
      <Contorno espessura={0.008} />
    </mesh>
  );
}

type TipoSensor = 'indutivo' | 'optico';

function Sensor({ anguloDeg, nome, ativo, tipo = 'indutivo' }: { anguloDeg: number; nome: string; ativo: boolean; tipo?: TipoSensor }) {
  const optico = tipo === 'optico';
  const corLed = optico ? (ativo ? '#4dff88' : '#1c3a26') : (ativo ? '#ff4d3a' : '#4a2420');
  const H = DIM.alturaEixo;
  const a = rad(anguloDeg);
  const xPoste = R_BRACO * Math.sin(a);
  const yPoste = H - R_BRACO * Math.cos(a);

  return (
    <>
      {/* poste de suporte até o chão */}
      <mesh position={[xPoste, yPoste / 2, Z_SENSORES]} castShadow>
        <boxGeometry args={[0.05, yPoste, 0.05]} />
        <Toon color="#6f7880" />
        <Contorno espessura={0.008} />
      </mesh>

      <group position={[0, H, Z_SENSORES]} rotation-z={a}>
        {/* braço radial */}
        <mesh position={[0, -(R_BRACO + 0.39) / 2, 0]}>
          <boxGeometry args={[0.035, R_BRACO - 0.39, 0.035]} />
          <Toon color="#6f7880" />
        </mesh>
        {/* corpo: indutivo M18 (cilindro latão) ou óptico (caixa azul), apontado para o tubo */}
        <mesh position={[0, -R_SENSOR, 0]} castShadow>
          {optico ? <boxGeometry args={[0.06, 0.1, 0.05]} /> : <cylinderGeometry args={[0.03, 0.03, 0.1, 18]} />}
          <Toon color={optico ? '#2f6db5' : '#c9a64a'} />
          <Contorno espessura={0.006} />
        </mesh>
        {optico && ativo && (
          <Line points={[[0, -R_SENSOR + 0.05, 0], [0, -R_CAME, 0]]} color="#ff3030" lineWidth={2} />
        )}
        {/* face sensora */}
        <mesh position={[0, -R_SENSOR + 0.052, 0]}>
          <cylinderGeometry args={[0.026, 0.026, 0.006, 18]} />
          <meshBasicMaterial color="#3b3f45" />
        </mesh>
        {/* LED na traseira */}
        <mesh position={[0, -R_SENSOR - 0.058, 0]}>
          <sphereGeometry args={[0.022, 14, 14]} />
          <meshBasicMaterial color={corLed} toneMapped={false} />
        </mesh>
        {/* sempre montada: ligar/desligar luzes recompila os shaders da cena */}
        <pointLight position={[0, -R_SENSOR - 0.09, 0]} color={optico ? '#4dff88' : '#ff5a3a'} intensity={ativo ? 0.6 : 0} distance={0.6} />
      </group>

      <Html position={[xPoste * 1.7, yPoste - 0.3, Z_SENSORES + 0.1]} center distanceFactor={9}
        className={`rotulo3d sensor ${tipo} ${ativo ? 'ativo' : ''}`}>
        {nome} {ativo ? '● ON' : '○'}
      </Html>
    </>
  );
}

/** Sensores fixos (não giram). Colocar no grupo do tracker, fora do grupo do painel. */
export function SensoresFimCurso() {
  const info = useStore((s) => s.info);
  const leste = useStore((s) => s.estado?.flags.fimCursoLeste ?? false);
  const oeste = useStore((s) => s.estado?.flags.fimCursoOeste ?? false);
  const optico = useStore((s) => s.estado?.flags.sensorOptico ?? false);

  return (
    <>
      <Sensor anguloDeg={info?.limiteLesteDeg ?? -60} nome="FC Leste" ativo={leste} />
      <Sensor anguloDeg={info?.limiteOesteDeg ?? 60} nome="FC Oeste" ativo={oeste} />
      <Sensor anguloDeg={info?.posicaoLimpezaDeg ?? 30} nome="Óptico limpeza" ativo={optico} tipo="optico" />
    </>
  );
}
