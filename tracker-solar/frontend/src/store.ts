import { create } from 'zustand';
import type { MsgCliente, MsgServidor, PlantInfo, PlantState } from '../../shared/types.ts';
import { HISTORICO_AMOSTRA_MS, HISTORICO_MAX_AMOSTRAS, WS_URL } from './config.ts';

export interface Amostra {
  t: number;
  setpoint: number;
  eixo: number;
  encoder: number;
  ideal: number;
  freq: number;
  erro: number;
}

interface Store {
  wsConectado: boolean;
  info: PlantInfo | null;
  estado: PlantState | null;
  historico: Amostra[];
  ultimoErro: { texto: string; t: number } | null;
  enviar: (msg: MsgCliente) => void;
}

let socket: WebSocket | null = null;
let ultimaAmostra = 0;

export const useStore = create<Store>(() => ({
  wsConectado: false,
  info: null,
  estado: null,
  historico: [],
  ultimoErro: null,
  enviar: (msg) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  },
}));

function receber(msg: MsgServidor) {
  if (msg.type === 'hello') {
    useStore.setState({ info: msg.info });
  } else if (msg.type === 'state') {
    const s = msg.data;
    const patch: Partial<Store> = { estado: s };
    if (s.t - ultimaAmostra >= HISTORICO_AMOSTRA_MS) {
      ultimaAmostra = s.t;
      const h = useStore.getState().historico;
      const nova: Amostra = {
        t: s.t,
        setpoint: s.eixo.setpointAtualDeg,
        eixo: s.eixo.posDeg,
        encoder: s.encoder.deg,
        ideal: s.sol.anguloIdealDeg,
        freq: s.escova.freqHz,
        erro: s.encoder.erroDeg,
      };
      patch.historico = h.length >= HISTORICO_MAX_AMOSTRAS ? [...h.slice(1), nova] : [...h, nova];
    }
    useStore.setState(patch);
  } else if (msg.type === 'erro') {
    useStore.setState({ ultimoErro: { texto: msg.mensagem, t: Date.now() } });
  }
}

export function conectar() {
  socket = new WebSocket(WS_URL);
  socket.onopen = () => useStore.setState({ wsConectado: true });
  socket.onmessage = (e) => {
    try { receber(JSON.parse(e.data)); } catch { /* ignora mensagem inválida */ }
  };
  socket.onclose = () => {
    useStore.setState({ wsConectado: false });
    setTimeout(conectar, 2000); // reconecta sozinho
  };
}
