import type { CSSProperties } from 'react';
import type { Flags } from '../../../shared/types.ts';
import { useStore } from '../store.ts';
import { fmt } from '../util.ts';

function Leitura({ rotulo, valor, cor, detalhe }: { rotulo: string; valor: string; cor: string; detalhe?: string }) {
  return (
    <div className="leitura" style={{ '--cor': cor } as CSSProperties}>
      <span className="leitura-rotulo">{rotulo}</span>
      <span className="leitura-valor">{valor}</span>
      {detalhe && <span className="leitura-detalhe">{detalhe}</span>}
    </div>
  );
}

const LEDS: { k: keyof Flags; rotulo: string; tipo: 'ok' | 'info' | 'alarme' }[] = [
  { k: 'pronto', rotulo: 'Pronto', tipo: 'ok' },
  { k: 'emAuto', rotulo: 'Automático', tipo: 'ok' },
  { k: 'referenciado', rotulo: 'Referenciado', tipo: 'ok' },
  { k: 'emMovimento', rotulo: 'Em movimento', tipo: 'info' },
  { k: 'sensorHome', rotulo: 'Sensor home', tipo: 'info' },
  { k: 'limpezaAtiva', rotulo: 'Limpeza', tipo: 'info' },
  { k: 'escovaLigada', rotulo: 'Escova ligada', tipo: 'info' },
  { k: 'travado', rotulo: 'Intertravado (vento)', tipo: 'alarme' },
  { k: 'emergencia', rotulo: 'Emergência', tipo: 'alarme' },
  { k: 'fimCursoLeste', rotulo: 'Sensor FC leste', tipo: 'info' },
  { k: 'fimCursoOeste', rotulo: 'Sensor FC oeste', tipo: 'info' },
  { k: 'sensorOptico', rotulo: 'Sensor óptico', tipo: 'info' },
  { k: 'motorHabilitado', rotulo: 'Motor EN', tipo: 'ok' },
  { k: 'pulsando', rotulo: 'PUL (pulsando)', tipo: 'info' },
  { k: 'sentidoLeste', rotulo: 'DIR → leste', tipo: 'info' },
  { k: 'reparado', rotulo: 'Reparado', tipo: 'info' },
  { k: 'falhaCommPC', rotulo: 'Falha comm. PC', tipo: 'alarme' },
];

export function StatusPanel() {
  const s = useStore((st) => st.estado);
  if (!s) return <section className="cartao"><h2>Estado</h2><p className="vazio">Sem dados.</p></section>;

  const ref = s.flags.referenciado;
  const erroAlto = ref && Math.abs(s.encoder.erroDeg) > 0.5;

  return (
    <section className="cartao">
      <h2>Posição</h2>
      <div className="leituras">
        <Leitura rotulo="Setpoint CLP" valor={fmt(s.eixo.setpointAtualDeg, 2, '°')} cor="var(--ambar)"
          detalhe={`sol ideal ${fmt(s.sol.anguloIdealDeg, 1, '°')}`} />
        <Leitura rotulo="Eixo (passo)" valor={fmt(s.eixo.posDeg, 2, '°')} cor="var(--ciano)"
          detalhe={`${fmt(s.eixo.velDegS, 2)} °/s`} />
        <Leitura rotulo="Encoder" valor={fmt(s.encoder.deg, 2, '°')} cor="var(--verde)"
          detalhe={`${s.encoder.contagem} contagens`} />
        <Leitura rotulo="Erro eixo − enc." valor={fmt(s.encoder.erroDeg, 2, '°')} cor={erroAlto ? 'var(--vermelho)' : 'var(--texto-2)'}
          detalhe={!ref ? 'aguardando HOME' : erroAlto ? 'passos perdidos?' : 'dentro do esperado'} />
      </div>

      <h2>Escovas · CFW10</h2>
      <div className="leituras tres">
        <Leitura rotulo="Frequência" valor={fmt(s.escova.freqHz, 0, ' Hz')} cor="var(--violeta)" detalhe={`multispeed ${s.escova.velIdx}`} />
        <Leitura rotulo="Motor (est.)" valor={fmt(s.escova.rpmMotor, 0)} cor="var(--violeta)" detalhe="rpm" />
        <Leitura rotulo="Escova (est.)" valor={fmt(s.escova.rpmEscova, 0)} cor="var(--violeta)" detalhe="rpm" />
      </div>

      <h2>Sinais</h2>
      <div className="leds">
        {LEDS.map(({ k, rotulo, tipo }) => (
          <span key={k} className={`led-item ${s.flags[k] ? `aceso ${tipo}` : ''}`}>
            <span className="led" />{rotulo}
          </span>
        ))}
      </div>
    </section>
  );
}
