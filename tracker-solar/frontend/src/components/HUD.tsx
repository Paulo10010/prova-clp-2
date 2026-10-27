import { PAINEL_SEGUE } from '../config.ts';
import { useStore } from '../store.ts';
import { dataLocal, fmt, horaLocal, normalPainel, rad, vetorSol } from '../util.ts';

/** Sobreposição na cena 3D: relógio simulado, sol, incidência e legenda. */
export function HUD() {
  const s = useStore((st) => st.estado);
  const info = useStore((st) => st.info);
  if (!s || !info) return <div className="hud"><div className="hud-bloco">Aguardando dados…</div></div>;

  const off = info.local.utcOffsetHoras;
  const real = PAINEL_SEGUE === 'encoder' ? s.encoder.deg : s.eixo.posDeg;

  // ângulo de incidência entre a normal do painel e o sol
  const [nx, ny] = normalPainel(real);
  const beta = rad(info.eixoAzimuteDeg);
  const n = [nx * Math.cos(beta), ny, nx * Math.sin(beta)];
  const sv = vetorSol(s.sol.azimuteDeg, s.sol.elevacaoDeg);
  const cosInc = n[0] * sv[0] + n[1] * sv[1] + n[2] * sv[2];
  const inc = (Math.acos(Math.max(-1, Math.min(1, cosInc))) * 180) / Math.PI;

  return (
    <div className="hud">
      <div className="hud-bloco relogio">
        <span className="hud-hora">{horaLocal(s.sol.relogioIso, off)}</span>
        <span className="hud-sub">
          {dataLocal(s.sol.relogioIso, off)} · {s.sol.velocidade === 0 ? 'pausado' : `×${s.sol.velocidade}`}
        </span>
      </div>

      <div className="hud-bloco">
        <div className="hud-linha"><span>Sol azimute</span><b>{fmt(s.sol.azimuteDeg, 1, '°')}</b></div>
        <div className="hud-linha"><span>Sol elevação</span><b>{fmt(s.sol.elevacaoDeg, 1, '°')}</b></div>
        <div className="hud-linha"><span>Incidência</span><b>{s.sol.diurno ? fmt(inc, 1, '°') : 'noite'}</b></div>
        <div className="hud-linha"><span>Aproveitamento</span><b>{s.sol.diurno ? fmt(Math.max(0, cosInc) * 100, 0, '%') : '—'}</b></div>
      </div>

      <div className="hud-legenda">
        <span><i style={{ background: '#4cc9f0' }} />Painel / normal</span>
        <span><i style={{ background: '#f2b43c' }} />Setpoint</span>
        <span><i className="tracejado" style={{ borderColor: '#f2b43c' }} />Direção do sol</span>
      </div>

      {!s.flags.referenciado && (
        <div className="hud-aviso">Eixo não referenciado: a posição mostrada não é confiável. Execute o HOME.</div>
      )}
    </div>
  );
}
