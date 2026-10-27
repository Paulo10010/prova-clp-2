import { useStore } from '../store.ts';
import { fmt } from '../util.ts';

/** Sensor (indutivo de fim de curso ou óptico da limpeza): LED + distância do came até ele. */
function SensorIndutivo({ nome, ativo, distanciaDeg, optico }: { nome: string; ativo: boolean; distanciaDeg: number; optico?: boolean }) {
  return (
    <div className={`sensor-ind ${optico ? 'optico' : ''} ${ativo ? 'ativo' : ''}`}>
      <span className="led" />
      <span className="sensor-nome">{nome}</span>
      <span className="sensor-dist">{ativo ? 'DETECTANDO' : `a ${fmt(Math.abs(distanciaDeg), 1, '°')}`}</span>
    </div>
  );
}

/** Ferramentas que só existem no modo simulador (testar o travamento sem mexer na bancada). */
export function SimPanel() {
  const info = useStore((st) => st.info);
  const estado = useStore((st) => st.estado);
  const enviar = useStore((st) => st.enviar);
  if (info?.fonte !== 'sim' || !estado) return null;

  const { flags, teste } = estado;
  const emergencia = flags.emergencia;
  const pos = estado.encoder.deg;
  const empurrar = (d: number) => enviar({ type: 'sim', acao: 'perturbar', deltaDeg: d });

  return (
    <section className="cartao sim">
      <h2>Simulador · teste automático</h2>
      <button className={`bt teste ${teste.ativo ? 'rodando' : ''}`} onClick={() => enviar({ type: 'sim', acao: 'teste', value: !teste.ativo })}>
        {teste.ativo ? '■ Cancelar teste' : '▶ Testar simulação (×1000)'}
      </button>
      {teste.ativo ? (
        <div className="teste-progresso">
          <div className="teste-barra">
            {Array.from({ length: teste.total }, (_, i) => <span key={i} className={i < teste.passo ? 'feito' : ''} />)}
          </div>
          <span>{teste.passo}/{teste.total} · {teste.texto}</span>
        </div>
      ) : teste.texto ? (
        <p className={`teste-resultado ${teste.ok ? 'ok' : 'falha'}`}>{teste.texto}</p>
      ) : (
        <p className="dica">Roda a rotina do CLP (leste → oeste → limpeza 20/60 Hz → home), um dia de sol ×1000 e uma rajada de vento para testar o intertravamento.</p>
      )}

      <h2>Sensores · fim de curso e posição de limpeza</h2>
      <div className="sensores-ind">
        <SensorIndutivo nome="Leste" ativo={flags.fimCursoLeste} distanciaDeg={pos - (info.limiteLesteDeg ?? -60)} />
        <SensorIndutivo nome="Oeste" ativo={flags.fimCursoOeste} distanciaDeg={(info.limiteOesteDeg ?? 60) - pos} />
        <SensorIndutivo nome={`Óptico ${info.posicaoLimpezaDeg}°`} ativo={flags.sensorOptico} distanciaDeg={info.posicaoLimpezaDeg - pos} optico />
      </div>

      <h2>Vento</h2>
      <p className="dica">Empurra o painel sem o motor saber. Com o eixo referenciado, o CLP vê o encoder divergir e o intertravamento leva o painel a 0°.</p>
      <div className="botoes">
        <button className="bt" onClick={() => empurrar(-1)}>Rajada −1°</button>
        <button className="bt" onClick={() => empurrar(0.3)}>+0,3°</button>
        <button className="bt" onClick={() => empurrar(3)}>+3°</button>
        <button className={`bt ${emergencia ? 'vermelho pulsa' : ''}`} onClick={() => enviar({ type: 'sim', acao: 'emergencia', value: !emergencia })}>
          {emergencia ? 'Liberar emergência' : 'Acionar emergência'}
        </button>
      </div>
    </section>
  );
}
