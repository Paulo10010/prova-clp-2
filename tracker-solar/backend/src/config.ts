/**
 * =====================================================================
 *  CONFIGURAÇÃO DA PLANTA  —  ARQUIVO PRINCIPAL PARA AJUSTES
 * =====================================================================
 *  Tudo que depende da sua bancada está aqui, separado por seção.
 *  Procure por ">>> ALTERE" para achar os pontos que provavelmente
 *  vão mudar. IP e número do DB ficam no arquivo backend/.env.
 * =====================================================================
 */
import 'dotenv/config';
import type { FonteDados } from '../../shared/types.ts';

const env = (k: string, def: string) => process.env[k] ?? def;

// ---------------------------------------------------------------------
// 1) CONEXÃO  (valores vêm do backend/.env)
// ---------------------------------------------------------------------
export const CONEXAO = {
  modo: (env('MODE', 'sim') === 'plc' ? 'plc' : 'sim') as FonteDados,
  plcIp: env('PLC_IP', '192.168.0.1'),     // >>> ALTERE no .env
  plcRack: Number(env('PLC_RACK', '0')),
  plcSlot: Number(env('PLC_SLOT', '1')),
  plcDb: Number(env('PLC_DB', '10')),        // >>> ALTERE no .env se o DB não for o 10
  pollMs: Number(env('PLC_POLL_MS', '200')),
  porta: Number(env('PORT', '8080')),
  logCsv: env('LOG_CSV', 'true') === 'true',
};

// ---------------------------------------------------------------------
// 2) LOCALIZAÇÃO  (usada no cálculo da posição do sol)
//    >>> ALTERE aqui para simular outro local
// ---------------------------------------------------------------------
export const LOCAL = {
  nome: 'Recife - PE',
  latitude: -8.0476,     // graus (negativo = Sul)
  longitude: -34.877,    // graus (negativo = Oeste)
  altitudeM: 4,          // metros acima do nível do mar
  utcOffsetHoras: -3,    // Recife não tem horário de verão
};

// ---------------------------------------------------------------------
// 3) GEOMETRIA E LIMITES DO TRACKER
// ---------------------------------------------------------------------
export const TRACKER = {
  /** Direção do eixo de rotação, em graus a partir do Norte. 0 = eixo Norte-Sul (padrão). */
  eixoAzimuteDeg: 0,
  /** >>> ALTERE: limites mecânicos/software do curso (negativo = leste). */
  limiteLesteDeg: -60,
  limiteOesteDeg: 60,
  /** Posição para onde o tracker vai à noite. */
  anguloNoiteDeg: 0,
  /** Posição atribuída ao eixo quando o sensor de home (leste) é encontrado. */
  posicaoHomeDeg: -60,
  /** Só reenvia o setpoint ao CLP se mudar mais que isso (evita escrita contínua). */
  bandaMortaSetpointDeg: 0.1,
  /** Intervalo mínimo entre escritas de setpoint no CLP (ms). */
  intervaloEscritaSetpointMs: 500,
};

// ---------------------------------------------------------------------
// 4) ENCODER  (incremental A/B, ligado em HSC)
// ---------------------------------------------------------------------
export const ENCODER = {
  ppr: 600,              // pulsos por volta do encoder
  quadratura: 4,         // >>> ALTERE: 1, 2 ou 4 conforme o modo de contagem do HSC (A/B x4 = 4)
  /** Voltas do encoder para cada volta do eixo do painel (1 = acoplado direto). */
  relacaoTransmissao: 1, // >>> ALTERE se houver polia/engrenagem entre encoder e painel
  /** Ângulo do painel quando a contagem do HSC é zero (o HSC é zerado no home). */
  anguloZeroDeg: -60,
  /** Sentido: 1 normal, -1 se a contagem cresce para o lado leste. */
  sentido: 1,
  /** "Qualquer mudança": travamento se |Δcontagem| >= este valor durante a limpeza. */
  toleranciaContagens: 1,
};

/** Contagens por grau do eixo do painel. */
export const CONTAGENS_POR_GRAU =
  (ENCODER.ppr * ENCODER.quadratura * ENCODER.relacaoTransmissao) / 360;

export function contagemParaGraus(contagem: number): number {
  return ENCODER.anguloZeroDeg + (ENCODER.sentido * contagem) / CONTAGENS_POR_GRAU;
}

// ---------------------------------------------------------------------
// 5) INVERSOR CFW10 + MOTOR DE INDUÇÃO (escovas)
// ---------------------------------------------------------------------
export const INVERSOR = {
  /**
   * >>> ALTERE: frequência (Hz) de cada combinação de multispeed.
   * Índice 0 = combinação 000 das entradas digitais, 1 = 001, ...
   * Copie aqui os valores que estiverem programados nos parâmetros de
   * referência de multispeed do CFW10 (confira no manual qual parâmetro
   * corresponde a cada combinação).
   */
  tabelaFreqHz: [10, 20, 30, 40, 50, 60, 60, 60],
  /** Número de polos do motor de indução (placa do motor). */
  polos: 4,
  /** Escorregamento estimado (0.04 = 4%). Só afeta a rpm exibida. */
  escorregamento: 0.04,
  /** Redução motor -> escova (1 = direto). */
  reducaoEscova: 1,
};

export function freqDoIndice(idx: number): number {
  const t = INVERSOR.tabelaFreqHz;
  return t[Math.max(0, Math.min(t.length - 1, Math.round(idx)))] ?? 0;
}

export function rpmMotor(freqHz: number): number {
  const nSinc = (120 * freqHz) / INVERSOR.polos;
  return nSinc * (1 - INVERSOR.escorregamento);
}

// ---------------------------------------------------------------------
// 6) PARÂMETROS SÓ DO SIMULADOR (não afetam o modo CLP)
// ---------------------------------------------------------------------
export const SIM = {
  velMaxDegS: 3,          // velocidade do eixo em rastreamento
  velHomingDegS: 6,       // velocidade na busca do sensor de home
  posicaoInicialDeg: 12,  // onde o painel está quando o simulador liga
};

// ---------------------------------------------------------------------
// 7) ROTINA DO CLP  (o que a lógica da bancada faz; o simulador imita)
//   1. vai a LESTE até o sensor indutivo (home / referência)
//   2. varre até o sensor indutivo OESTE
//   3. vai para a posição de limpeza; o sensor óptico confirma a posição;
//      limpeza em 20 Hz (motor de passo trepidando em microstep) e depois 60 Hz
//   4. volta para o home (posição de alvorada)
//   5. vento: se o encoder divergir do eixo, intertravamento leva o painel a 0°
// ---------------------------------------------------------------------
export const ROTINA = {
  /** >>> ALTERE: posição onde fica o sensor óptico da limpeza (positivo = oeste). */
  posicaoLimpezaDeg: 30,
  /** Faixa em que o sensor óptico enxerga o alvo. */
  bandaSensorOpticoDeg: 0.5,
  /** Estágio 1 da limpeza: frequência do CFW10 e duração. */
  limpezaFreq1Hz: 20,
  limpezaTempo1S: 10,
  /** Estágio 2 da limpeza. */
  limpezaFreq2Hz: 60,
  limpezaTempo2S: 10,
  /** Trepidação do motor de passo no estágio 1 (no simulador; amplitude exagerada para ser visível no 3D). */
  microstepAmplitudeDeg: 0.5,
  microstepFreqHz: 2,
  /** Posição do intertravamento por vento (0 = painel paralelo ao chão). */
  posicaoIntertravamentoDeg: 0,
};

/** Valores de Status.Etapa_Rotina (devem bater com a lógica do CLP). */
export const ETAPAS_ROTINA: Record<number, string> = {
  0: 'Fora da rotina (parado ou rastreando o sol)',
  1: 'Buscando o sensor LESTE (home)',
  2: 'Varredura até o sensor OESTE',
  3: 'Indo para a posição de limpeza (sensor óptico)',
  4: 'Limpeza 20 Hz · motor de passo trepidando em microstep',
  5: 'Limpeza 60 Hz',
  6: 'Voltando ao home (posição de alvorada)',
  7: 'Intertravamento por vento: indo para 0°',
  8: 'Intertravado em 0° (aguardando RESET)',
};

export function textoEtapa(etapa: number): string {
  return ETAPAS_ROTINA[etapa] ?? `Etapa ${etapa}`;
}

// ---------------------------------------------------------------------
// 8) RELÓGIO SOLAR SIMULADO
// ---------------------------------------------------------------------
export const RELOGIO = {
  /** Multiplicadores oferecidos na interface (1 = tempo real). */
  velocidades: [0, 1, 60, 300, 1800],
  velocidadeInicial: 60,
  /** Hora inicial (no fuso do LOCAL). null = hora atual do computador. */
  horaInicialLocal: '07:00' as string | null,
};

// ---------------------------------------------------------------------
// 9) CÓDIGOS DE ALARME  (devem bater com o que sua lógica escreve em
//    DB_Supervisorio.Status.Codigo_Alarme)
// ---------------------------------------------------------------------
export const ALARMES: Record<number, string> = {
  0: 'Sem alarme',
  1: 'Emergência acionada',
  2: 'Fim de curso LESTE',
  3: 'Fim de curso OESTE',
  10: 'Vento: encoder divergiu do eixo — intertravamento, painel em 0°',
  11: 'Sensor óptico não confirmou a posição de limpeza',
  20: 'CLP sem comunicação com o PC (watchdog)',
  30: 'Falha no eixo (Technology Object)',
};

export function textoAlarme(codigo: number): string {
  return ALARMES[codigo] ?? `Alarme ${codigo} (sem descrição em config.ts)`;
}
