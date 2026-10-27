import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.ts';

function Indicador({ ok, rotulo, valor }: { ok: boolean; rotulo: string; valor: string }) {
  return (
    <div className={`indicador ${ok ? 'ok' : 'falha'}`}>
      <span className="led" />
      <span className="ind-rotulo">{rotulo}</span>
      <span className="ind-valor">{valor}</span>
    </div>
  );
}

/** Pisca quando o contador de vida do CLP muda; se parar de mudar, o CLP travou. */
function useVivo(vivo: number | undefined) {
  const [ativo, setAtivo] = useState(false);
  const ultimo = useRef<{ v?: number; t: number }>({ t: 0 });
  useEffect(() => {
    const agora = Date.now();
    if (vivo !== ultimo.current.v) ultimo.current = { v: vivo, t: agora };
  }, [vivo]);
  useEffect(() => {
    const id = setInterval(() => setAtivo(Date.now() - ultimo.current.t < 1500), 300);
    return () => clearInterval(id);
  }, []);
  return ativo;
}

export function TopBar() {
  const ws = useStore((s) => s.wsConectado);
  const info = useStore((s) => s.info);
  const plc = useStore((s) => s.estado?.plcConectado ?? false);
  const vivoPlc = useStore((s) => s.estado?.vivoPlc);
  const falhaComm = useStore((s) => s.estado?.flags.falhaCommPC ?? false);
  const vivo = useVivo(vivoPlc);
  const sim = info?.fonte === 'sim';

  return (
    <header className="topo">
      <div className="marca">
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
          <circle cx="23" cy="9" r="5" fill="#f2b43c" />
          <path d="M3 25 L15 17 L27 25" stroke="#4cc9f0" strokeWidth="2.5" fill="none" />
          <path d="M15 17 V29" stroke="#8a939c" strokeWidth="2" />
        </svg>
        <div>
          <h1>Tracker Solar</h1>
          <p>Gêmeo digital · S7-1200 · {info?.local.nome ?? '…'}</p>
        </div>
      </div>
      <div className="indicadores">
        <span className={`fonte ${sim ? 'sim' : 'plc'}`}>{sim ? 'SIMULADOR' : 'CLP REAL'}</span>
        <Indicador ok={ws} rotulo="Servidor" valor={ws ? 'online' : 'offline'} />
        <Indicador ok={plc} rotulo={sim ? 'Planta sim.' : 'CLP'} valor={plc ? 'conectado' : 'sem conexão'} />
        <Indicador ok={vivo} rotulo="Vida CLP" valor={vivoPlc !== undefined ? String(vivoPlc) : '—'} />
        <Indicador ok={!falhaComm} rotulo="Watchdog" valor={falhaComm ? 'falha' : 'ok'} />
      </div>
    </header>
  );
}
