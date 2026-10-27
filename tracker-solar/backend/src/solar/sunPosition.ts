/**
 * Posição do sol (modelo simplificado da NOAA, erro típico < 0,5°).
 *
 * Para trocar de local, NÃO mexa aqui: altere LOCAL em src/config.ts.
 * Para trocar o modelo (ex.: SPA completo), substitua só a função
 * `posicaoSol`, mantendo a mesma assinatura de retorno.
 */

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export interface PosicaoSol {
  azimuteDeg: number;   // 0 = Norte, 90 = Leste, 180 = Sul, 270 = Oeste
  elevacaoDeg: number;  // acima do horizonte
}

export function posicaoSol(data: Date, latitudeDeg: number, longitudeDeg: number): PosicaoSol {
  const ano = data.getUTCFullYear();
  const inicioAno = Date.UTC(ano, 0, 1);
  const diaDoAno = Math.floor((data.getTime() - inicioAno) / 86_400_000) + 1;
  const horaUtc = data.getUTCHours() + data.getUTCMinutes() / 60 + data.getUTCSeconds() / 3600;
  const diasNoAno = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0 ? 366 : 365;

  // Ano fracionário (rad)
  const g = ((2 * Math.PI) / diasNoAno) * (diaDoAno - 1 + (horaUtc - 12) / 24);

  // Equação do tempo (min) e declinação solar (rad)
  const eqTempo =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);

  // Tempo solar verdadeiro (min) e ângulo horário (rad)
  const tempoSolar = horaUtc * 60 + eqTempo + 4 * longitudeDeg;
  const anguloHorario = rad(tempoSolar / 4 - 180);

  const lat = rad(latitudeDeg);
  const cosZen =
    Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(anguloHorario);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZen)));

  let az = deg(
    Math.atan2(
      Math.sin(anguloHorario),
      Math.cos(anguloHorario) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat),
    ),
  ) + 180;
  az = ((az % 360) + 360) % 360;

  return { azimuteDeg: az, elevacaoDeg: 90 - deg(zen) };
}

/**
 * Elevação abaixo da qual o sol é considerado "posto":
 * raio do disco + refração (0,833°) + depressão do horizonte pela altitude.
 * É aqui que a ALTITUDE do local entra no modelo (efeito pequeno).
 */
export function elevacaoPorDoSol(altitudeM: number): number {
  // Depressão do horizonte ≈ 1,76'·√h  →  0,0293°·√h  (h em metros)
  const depressaoDeg = 0.0293 * Math.sqrt(Math.max(0, altitudeM));
  return -0.833 - depressaoDeg;
}

/**
 * Ângulo de rotação ideal de um tracker de 1 eixo horizontal.
 * Convenção: negativo = virado para leste, positivo = oeste.
 * Sem backtracking (sombreamento entre fileiras não é considerado).
 */
export function anguloIdealTracker(sol: PosicaoSol, eixoAzimuteDeg: number): number {
  const el = rad(sol.elevacaoDeg);
  // componente horizontal do vetor do sol perpendicular ao eixo (positivo = lado leste do eixo)
  const sPerp = Math.cos(el) * Math.sin(rad(sol.azimuteDeg - eixoAzimuteDeg));
  const sVert = Math.sin(el);
  return deg(Math.atan2(-sPerp, sVert));
}
