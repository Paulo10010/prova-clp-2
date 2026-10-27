/**
 * Teste rápido do cálculo solar:  npm run test:solar -w backend
 * Imprime azimute, elevação e ângulo do tracker ao longo de um dia em Recife.
 */
import { LOCAL, TRACKER } from '../config.ts';
import { anguloIdealTracker, posicaoSol } from './sunPosition.ts';

const dia = process.argv[2] ?? '2026-03-20';
console.log(`Local: ${LOCAL.nome}  (${LOCAL.latitude}, ${LOCAL.longitude})  dia ${dia}\n`);
console.log('hora  azimute  elevação  tracker');
for (let h = 5; h <= 18; h++) {
  const d = new Date(`${dia}T${String(h).padStart(2, '0')}:00:00-03:00`);
  const s = posicaoSol(d, LOCAL.latitude, LOCAL.longitude);
  const a = anguloIdealTracker(s, TRACKER.eixoAzimuteDeg);
  console.log(
    `${String(h).padStart(2, '0')}:00  ${s.azimuteDeg.toFixed(1).padStart(6)}°  ${s.elevacaoDeg.toFixed(1).padStart(6)}°  ${a.toFixed(1).padStart(6)}°`,
  );
}
