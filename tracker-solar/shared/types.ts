/**
 * Tipos compartilhados entre backend e frontend.
 * Use sempre `import type` para que nada daqui vire código em runtime.
 *
 * Convenção de ângulo do tracker (1 eixo, eixo N-S):
 *   negativo = painel virado para LESTE (manhã)
 *   0        = painel na horizontal
 *   positivo = painel virado para OESTE (tarde)
 */

export type FonteDados = 'sim' | 'plc';

export interface Flags {
  emAuto: boolean;
  emMovimento: boolean;
  referenciado: boolean;   // homing feito
  sensorHome: boolean;
  limpezaAtiva: boolean;
  escovaLigada: boolean;
  travado: boolean;        // intertravamento por vento (encoder divergiu do eixo)
  emergencia: boolean;
  fimCursoLeste: boolean;
  fimCursoOeste: boolean;
  pronto: boolean;
  falhaCommPC: boolean;    // watchdog do CLP não vê o PC
  sensorOptico: boolean;   // confirma a posição de limpeza
  motorHabilitado: boolean; // EN do driver do motor de passo
  sentidoLeste: boolean;   // DIR: eixo girando para leste
  pulsando: boolean;       // PUL: eixo gerando pulsos
  reparado: boolean;       // botão Reparado
}

export interface ComandosAtuais {
  modoAuto: boolean;
  usaSetpointPC: boolean;
  fonteSetpoint: 'sol' | 'manual';
  setpointManualDeg: number;
  setpointEnviadoDeg: number;
  escovaVelIdx: number;
}

export interface EstadoSol {
  relogioIso: string;      // hora simulada (UTC, ISO)
  velocidade: number;      // multiplicador do relógio (0 = pausado)
  azimuteDeg: number;      // a partir do Norte, sentido horário
  elevacaoDeg: number;
  anguloIdealDeg: number;  // ângulo do tracker que aponta para o sol (já limitado)
  anguloIdealLivreDeg: number; // sem limites mecânicos
  diurno: boolean;
}

/** Progresso do teste automático do simulador. */
export interface EstadoTeste {
  ativo: boolean;
  texto: string;           // etapa atual ou resultado do último teste
  passo: number;           // 1..total durante o teste, 0 parado
  total: number;
  ok: boolean;             // resultado do último teste
}

export interface PlantState {
  t: number;               // timestamp do servidor (ms)
  fonte: FonteDados;
  plcConectado: boolean;
  vivoPlc: number;
  eixo: {
    posDeg: number;            // posição do eixo (Technology Object / PTO)
    velDegS: number;
    setpointAtualDeg: number;  // setpoint que o CLP está usando
  };
  encoder: {
    contagem: number;          // contagem bruta do HSC
    deg: number;               // convertido pelo backend
    erroDeg: number;           // eixo - encoder (passos perdidos / deslocamento)
  };
  escova: {
    velIdx: number;
    freqHz: number;            // frequência comandada (tabela multispeed)
    rpmMotor: number;          // estimada
    rpmEscova: number;         // estimada
  };
  flags: Flags;
  alarme: { codigo: number; texto: string };
  comandos: ComandosAtuais;
  sol: EstadoSol;
  rotina: { etapa: number; texto: string };  // etapa da rotina do CLP (ver ETAPAS_ROTINA no backend)
  teste: EstadoTeste;
}

/** Informações estáticas enviadas uma vez ao conectar (vêm do config.ts do backend). */
export interface PlantInfo {
  fonte: FonteDados;
  local: { nome: string; latitude: number; longitude: number; altitudeM: number; utcOffsetHoras: number };
  eixoAzimuteDeg: number;
  limiteLesteDeg: number;
  limiteOesteDeg: number;
  tabelaFreqHz: number[];
  velocidadesRelogio: number[];
  limpezaDuracaoS: number;
  posicaoLimpezaDeg: number;
  etapasRotina: Record<number, string>;
}

// ---- Mensagens WebSocket ----

export type ComandoPulso = 'start' | 'stop' | 'home' | 'limpar' | 'reset';

export type MsgCliente =
  | { type: 'cmd'; cmd: ComandoPulso }
  | { type: 'set'; key: 'modoAuto' | 'usaSetpointPC'; value: boolean }
  | { type: 'set'; key: 'fonteSetpoint'; value: 'sol' | 'manual' }
  | { type: 'set'; key: 'setpointManualDeg' | 'escovaVelIdx'; value: number }
  | { type: 'relogio'; velocidade?: number; irParaIso?: string; agora?: boolean }
  | { type: 'sim'; acao: 'perturbar'; deltaDeg: number }
  | { type: 'sim'; acao: 'emergencia'; value: boolean }
  | { type: 'sim'; acao: 'teste'; value: boolean };

export type MsgServidor =
  | { type: 'hello'; info: PlantInfo }
  | { type: 'state'; data: PlantState }
  | { type: 'erro'; mensagem: string };
