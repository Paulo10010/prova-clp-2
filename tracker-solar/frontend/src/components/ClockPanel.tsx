import { useState } from 'react';
import { useStore } from '../store.ts';
import { localParaIso } from '../util.ts';

/** Controle do relógio solar simulado (o CLP recebe o setpoint resultante). */
export function ClockPanel() {
  const info = useStore((st) => st.info);
  const sol = useStore((st) => st.estado?.sol);
  const enviar = useStore((st) => st.enviar);
  const [valor, setValor] = useState('');
  if (!info || !sol) return null;

  const off = info.local.utcOffsetHoras;
  const dataSim = new Date(Date.parse(sol.relogioIso) + off * 3_600_000).toISOString().slice(0, 10);
  const irPara = (hhmm: string) => enviar({ type: 'relogio', irParaIso: localParaIso(`${dataSim}T${hhmm}`, off) });

  return (
    <section className="cartao">
      <h2>Relógio solar · {info.local.nome}</h2>
      <div className="segmentado largo">
        {info.velocidadesRelogio.map((v) => (
          <button key={v} className={sol.velocidade === v ? 'ativo' : ''} onClick={() => enviar({ type: 'relogio', velocidade: v })}>
            {v === 0 ? 'Pausa' : v === 1 ? 'Real' : `×${v}`}
          </button>
        ))}
      </div>
      <div className="atalhos">
        <button onClick={() => irPara('06:00')}>Manhã 06:00</button>
        <button onClick={() => irPara('11:30')}>Meio-dia 11:30</button>
        <button onClick={() => irPara('16:00')}>Tarde 16:00</button>
        <button onClick={() => irPara('19:00')}>Noite 19:00</button>
        <button onClick={() => enviar({ type: 'relogio', agora: true })}>Agora</button>
      </div>
      <div className="ir-para">
        <input type="datetime-local" value={valor} onChange={(e) => setValor(e.target.value)} aria-label="Data e hora (local)" />
        <button disabled={!valor} onClick={() => enviar({ type: 'relogio', irParaIso: localParaIso(valor, off) })}>Ir</button>
      </div>
      <p className="dica">Lat {info.local.latitude}°, lon {info.local.longitude}°, alt {info.local.altitudeM} m · altere em backend/src/config.ts</p>
    </section>
  );
}
