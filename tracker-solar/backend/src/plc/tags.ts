/**
 * =====================================================================
 *  MAPA DE TAGS  —  DB_Supervisorio (NÃO OTIMIZADO)
 * =====================================================================
 *  Os offsets abaixo têm que bater com a coluna "Offset" do DB no
 *  TIA Portal (compile o DB e confira). Se você mudar a estrutura do
 *  DB no CLP, mude aqui também.
 *
 *  Sintaxe nodes7:  DB<n>,INT<byte>  DB<n>,REAL<byte>  DB<n>,DINT<byte>
 *                   DB<n>,X<byte>.<bit>
 *  O número do DB vem de PLC_DB no backend/.env.
 * =====================================================================
 */
import { CONEXAO } from '../config.ts';

const db = CONEXAO.plcDb;
const a = (s: string) => `DB${db},${s}`;

/** Status: CLP -> PC (somente leitura). */
export const TAGS_STATUS = {
  vivoPlc:          a('INT0'),
  posEixoDeg:       a('REAL2'),
  velEixoDegS:      a('REAL6'),
  encoderContagem:  a('DINT10'),
  setpointAtualDeg: a('REAL14'),
  escovaVelIdx:     a('INT18'),
  codigoAlarme:     a('INT20'),
  emAuto:           a('X22.0'),
  emMovimento:      a('X22.1'),
  referenciado:     a('X22.2'),
  sensorHome:       a('X22.3'),
  limpezaAtiva:     a('X22.4'),
  escovaLigada:     a('X22.5'),
  travado:          a('X22.6'),
  emergencia:       a('X22.7'),
  fimCursoLeste:    a('X23.0'),
  fimCursoOeste:    a('X23.1'),
  pronto:           a('X23.2'),
  falhaCommPC:      a('X23.3'),
  sensorOptico:     a('X23.4'),
  etapaRotina:      a('INT24'),
  // bytes 26..31 reservados para expansão
} as const;

/** Comandos: PC -> CLP (escrita). Os Cmd_* são pulsos: o PC escreve TRUE e o CLP zera. */
export const TAGS_COMANDO = {
  vivoPc:        a('INT32'),
  setpointDeg:   a('REAL34'),
  escovaVelIdx:  a('INT38'),
  cmdStart:      a('X40.0'),
  cmdStop:       a('X40.1'),
  cmdHome:       a('X40.2'),
  cmdLimpar:     a('X40.3'),
  cmdReset:      a('X40.4'),
  modoAuto:      a('X40.5'),
  usaSetpointPC: a('X40.6'),
} as const;

export type CampoStatus = keyof typeof TAGS_STATUS;
export type CampoComando = keyof typeof TAGS_COMANDO;

export type StatusDB = {
  [K in CampoStatus]: K extends
    | 'vivoPlc' | 'posEixoDeg' | 'velEixoDegS' | 'encoderContagem'
    | 'setpointAtualDeg' | 'escovaVelIdx' | 'codigoAlarme' | 'etapaRotina'
    ? number
    : boolean;
};

export type ValorComando = number | boolean;

/** Interface comum ao simulador e ao CLP real. */
export interface PlantSource {
  readonly conectado: boolean;
  iniciar(): void;
  parar(): void;
  /** Última imagem lida do DB (null se nunca leu). */
  ler(): StatusDB | null;
  /** Agenda uma escrita; o driver envia no próximo ciclo. */
  escrever(campo: CampoComando, valor: ValorComando): void;
}
