import { useEffect, useState } from 'react';
import { useStore } from '../store.ts';
import { fmt } from '../util.ts';

export function ControlPanel() {
  const s = useStore((st) => st.estado);
  const info = useStore((st) => st.info);
  const ws = useStore((st) => st.wsConectado);
  const enviar = useStore((st) => st.enviar);

  const [spLocal, setSpLocal] = useState(0);
  const spServidor = s?.comandos.setpointManualDeg;
  useEffect(() => { if (spServidor !== undefined) setSpLocal(spServidor); }, [spServidor]);

  if (!s || !info) return <section className="cartao"><h2>Comandos</h2><p className="vazio">Sem dados.</p></section>;

  const f = s.flags;
  const c = s.comandos;
  const off = !ws || !s.plcConectado;

  const motivoLimpar = !f.referenciado ? 'faça o HOME antes'
    : f.travado ? 'intertravado por vento: use RESET'
    : f.emMovimento ? 'aguarde o eixo parar'
    : f.limpezaAtiva ? 'limpeza em andamento'
    : s.rotina.etapa !== 0 ? 'rotina em andamento' : null;

  const cmd = (c: 'start' | 'stop' | 'home' | 'limpar' | 'reset') => enviar({ type: 'cmd', cmd: c });

  return (
    <section className="cartao">
      <h2>Comandos</h2>
      <div className="botoes">
        <button className="bt verde" disabled={off} onClick={() => cmd('start')}>Start</button>
        <button className="bt vermelho" disabled={!ws} onClick={() => cmd('stop')}>Stop</button>
        <button className="bt" disabled={off} onClick={() => cmd('home')} title="Rotina completa: leste → oeste → limpeza → home">Home</button>
        <button className="bt ciano" disabled={off || !!motivoLimpar} onClick={() => cmd('limpar')} title={motivoLimpar ?? 'Vai a 30° (sensor óptico), limpa a 20 Hz e 60 Hz e volta ao home'}>Limpar</button>
        <button className={`bt ${f.travado || s.alarme.codigo ? 'ambar pulsa' : ''}`} disabled={off} onClick={() => cmd('reset')} title="Rearma e refaz a rotina completa">Reset</button>
      </div>
      {motivoLimpar && <p className="dica">Limpar: {motivoLimpar}.</p>}

      <div className="linha-controle">
        <span>Modo automático</span>
        <Chave ligada={c.modoAuto} disabled={off} onChange={(v) => enviar({ type: 'set', key: 'modoAuto', value: v })} />
      </div>

      <div className="linha-controle">
        <span>Setpoint vem de</span>
        <div className="segmentado">
          <button className={c.fonteSetpoint === 'sol' ? 'ativo' : ''} onClick={() => enviar({ type: 'set', key: 'fonteSetpoint', value: 'sol' })}>Sol calculado</button>
          <button className={c.fonteSetpoint === 'manual' ? 'ativo' : ''} onClick={() => enviar({ type: 'set', key: 'fonteSetpoint', value: 'manual' })}>Manual</button>
        </div>
      </div>

      {c.fonteSetpoint === 'manual' && (
        <div className="slider-linha">
          <input
            type="range"
            min={info.limiteLesteDeg}
            max={info.limiteOesteDeg}
            step={0.5}
            value={spLocal}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSpLocal(v);
              enviar({ type: 'set', key: 'setpointManualDeg', value: v });
            }}
          />
          <span className="slider-valor">{fmt(spLocal, 1, '°')}</span>
          <div className="slider-escala"><span>Leste {info.limiteLesteDeg}°</span><span>0°</span><span>Oeste {info.limiteOesteDeg}°</span></div>
        </div>
      )}

      <div className="linha-controle">
        <span title="Se desligado, o CLP ignora o setpoint enviado pelo PC">CLP segue setpoint do PC</span>
        <Chave ligada={c.usaSetpointPC} disabled={off} onChange={(v) => enviar({ type: 'set', key: 'usaSetpointPC', value: v })} />
      </div>

      <h2>Velocidade das escovas (multispeed)</h2>
      <div className="multispeed">
        {info.tabelaFreqHz.map((hz, i) => (
          <button
            key={i}
            className={c.escovaVelIdx === i ? 'ativo' : ''}
            disabled={off}
            onClick={() => enviar({ type: 'set', key: 'escovaVelIdx', value: i })}
            title={`Combinação ${i.toString(2).padStart(3, '0')} nas DIs do CFW10`}
          >
            <b>{hz}</b><small>Hz</small><em>{i.toString(2).padStart(3, '0')}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function Chave({ ligada, onChange, disabled }: { ligada: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={ligada}
      disabled={disabled}
      className={`chave ${ligada ? 'ligada' : ''}`}
      onClick={() => onChange(!ligada)}
    >
      <span />
    </button>
  );
}
